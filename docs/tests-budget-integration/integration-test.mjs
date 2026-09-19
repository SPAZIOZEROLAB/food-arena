import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';

// Explicit opt-in prevents accidentally creating a demo or sending Fuji operations.
const dir=path.dirname(fileURLToPath(import.meta.url));
const option=name=>{const i=process.argv.indexOf('--'+name);return i<0?undefined:process.argv[i+1];};
if(!process.argv.includes('--run')) {
 console.log('Prepared only. After root READY: node integration-test.mjs --run --manifest <public-deployment.json> --sqlite <local-D1.sqlite>');
 process.exit(0);
}
const manifestPath=option('manifest');
if(!manifestPath)throw Error('--manifest is required; no address or network is guessed');
const manifest=JSON.parse(fs.readFileSync(path.resolve(manifestPath),'utf8'));
const base=new URL(option('base')||'http://localhost:5173');
if(base.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(base.hostname)||base.port!=='5173')throw Error('Only local HTTP port 5173 is allowed');
if(Number(manifest.chainId)!==43113||!manifest.rpc||!manifest.contract||!manifest.beneficiary)throw Error('Public manifest must contain chainId=43113, rpc, contract, beneficiary');
const sqlitePath=option('sqlite')||manifest.sqlitePath;
if(!sqlitePath)throw Error('Read-only local D1 path is required to verify stock, not infer it');
const dep=createRequire(path.resolve(dir,'../../package.json'));
const {JsonRpcProvider,Contract,keccak256,toUtf8Bytes,AbiCoder,getAddress,ZeroAddress}=dep('ethers');
const artifact=JSON.parse(fs.readFileSync(path.join(dir,'FoodArenaBudgetFuji.json'),'utf8'));
const contractAddress=getAddress(manifest.contract),beneficiary=getAddress(manifest.beneficiary);
if(contractAddress===ZeroAddress)throw Error('Deployment manifest is not ready');
const provider=new JsonRpcProvider(manifest.rpc,43113,{cacheTimeout:-1});
const chain=new Contract(contractAddress,artifact.abi,provider);
const sql=new DatabaseSync(path.resolve(sqlitePath),{readOnly:true});
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const resultPath=path.join(dir,`integration-result-${runId}.json`);
const report={runId,startedAt:new Date().toISOString(),base:base.origin,contract:contractAddress,chainId:43113,sourceSha256:artifact.sourceSha256,checks:[],transitions:[],http:[],maxHttpConcurrency:0,requestId:null,offerId:null,onchain:{},stock:{},limitations:[]};
let ownerCookie='',requestId,chosen,finished=false,httpActive=0;
const queue=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const redact=(value,key='')=>{
 if(/^(code|cookie|signature|settle_signature|raw_tx|privateKey|owner_hash)$/i.test(key))return '[redacted]';
 if(Array.isArray(value))return value.map(v=>redact(v));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redact(v,k)]));
 return typeof value==='bigint'?value.toString():value;
};
const save=()=>fs.writeFileSync(resultPath,JSON.stringify(redact(report),null,2));
const check=(name,passed,detail)=>{report.checks.push({name,passed:!!passed,detail:redact(detail)});console.log(`${passed?'PASS':'FAIL'} ${name}`);save();return !!passed;};
const requireCheck=(name,passed,detail)=>{if(!check(name,passed,detail))throw Error(name);};
async function acquire(){if(httpActive>=12)await new Promise(resolve=>queue.push(resolve));httpActive++;report.maxHttpConcurrency=Math.max(report.maxHttpConcurrency,httpActive);}
function release(){httpActive--;queue.shift()?.();}
async function http(method,body,cookie=ownerCookie,label=body?.action||'request view'){
 await acquire();const started=Date.now();let status=0,data;
 try{
  const url=new URL('/api/passo',base);if(method==='GET'){url.searchParams.set('view','request');url.searchParams.set('id',requestId);}
  const response=await fetch(url,{method,headers:{...(method==='POST'?{'content-type':'application/json','origin':base.origin}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
  status=response.status;const text=await response.text();try{data=JSON.parse(text);}catch{data={nonJson:text.slice(0,200)};}
  const issued=response.headers.get('set-cookie')?.match(/passo_ticket=[a-f0-9]{64}/)?.[0];
  if(issued&&label==='create demo')ownerCookie=issued;
  return {status,ok:response.ok,data};
 }catch(error){data={networkError:String(error)};return {status,ok:false,data};}
 finally{report.http.push({label,method,status,ms:Date.now()-started,body:redact(data)});release();save();}
}
const post=(body,cookie=ownerCookie,label)=>http('POST',body,cookie,label);
function noCodes(view){return view.offers?.every(o=>!Object.hasOwn(o,'code'))===true;}
function observe(view){
 if(!view?.request)return;
 const row={at:new Date().toISOString(),status:view.request.status,chosen:view.request.chosen||null,budgetState:view.budgetSettlement?.state||null,codeCount:view.offers.filter(o=>Object.hasOwn(o,'code')).length};
 const last=report.transitions.at(-1);if(!last||['status','chosen','budgetState','codeCount'].some(k=>last[k]!==row[k])){report.transitions.push(row);console.log(`STATE ${row.status} / ${row.budgetState} / visible codes ${row.codeCount}`);save();}
 if(view.request.status==='reserving'&&!noCodes(view))throw Error('Pickup code leaked while reserving');
}
async function view(cookie=ownerCookie,label){const r=await http('GET',undefined,cookie,label);if(r.ok&&cookie===ownerCookie)observe(r.data);return r;}
async function poll(target,timeoutMs=180000){
 const deadline=Date.now()+timeoutMs;
 while(Date.now()<deadline){
  const current=await view();if(current.ok&&current.data.request.status===target)return current.data;
  if(current.ok&&['cancelled','collected'].includes(current.data.request.status))throw Error(`Unexpected terminal state ${current.data.request.status}, expected ${target}`);
  const synced=await post({action:'syncBudget',requestId});
  if(synced.status>=400&&![409,503].includes(synced.status))throw Error('syncBudget rejected '+synced.status);
  await pause(1800);
 }
 throw Error(`Timed out waiting for ${target}; request remains available for recovery`);
}
const stock=menuId=>Number(sql.prepare('SELECT stock FROM menu WHERE id=?').get(menuId)?.stock);
const budgetRow=offerId=>sql.prepare('SELECT order_id,merchant,amount,expires_at,terms_hash,status,hold_tx,settle_tx FROM budget_offers WHERE offer_id=?').get(offerId);
const account=async merchant=>{
 const m=await chain.merchants(merchant);return {available:m.available.toString(),reserved:m.reserved.toString(),spent:m.spent.toString(),credits:(await chain.credits(beneficiary)).toString()};
};
const plainOrder=o=>({merchant:o.merchant,beneficiary:o.beneficiary,amount:o.amount.toString(),expiresAt:Number(o.expiresAt),termsHash:o.termsHash,fulfilmentHash:o.fulfilmentHash,state:Number(o.state)});

try{
 requireCheck('RPC is Avalanche Fuji',Number(await provider.send('eth_chainId',[]))===43113);
 requireCheck('deployed bytecode equals tested artifact',(await provider.getCode(contractAddress)).toLowerCase()===artifact.deployedBytecode.toLowerCase());
 const startBlock=await provider.getBlockNumber();report.onchain.fromBlock=startBlock;
 // Read-only schema check before creating the sole request.
 sql.prepare('SELECT stock FROM menu LIMIT 0').all();sql.prepare('SELECT order_id FROM budget_offers LIMIT 0').all();
 const created=await post({action:'request',budget:1000,quantity:1,minutes:30,zone:'Università / Viale Pindaro',wish:'Integration test: pranzo completo entro trenta minuti',vegetarian:false,demo:true,arena:true},'','create demo');
 requireCheck('one demo request created with owner cookie',created.status===201&&!!created.data.id&&!!ownerCookie,{status:created.status,response:created.data});
 requestId=created.data.id;report.requestId=requestId;
 const initialResponse=await view();requireCheck('owner sees three scripted offers',initialResponse.ok&&initialResponse.data.mine===true&&initialResponse.data.offers.length===3&&initialResponse.data.offers.every(o=>o.scripted===1&&o.demo===1),initialResponse.data);
 const initial=initialResponse.data,offers=initial.offers;
 requireCheck('all demo offers fit total budget',offers.every(o=>o.price<=1000&&o.quantity===1));
 requireCheck('no pickup code before acceptance',noCodes(initial));
 for(const o of offers){report.stock[o.menu_id]={before:stock(o.menu_id)};requireCheck(`stock available for ${o.title}`,report.stock[o.menu_id].before===1);}
 const rows=offers.map(o=>budgetRow(o.id));requireCheck('three signed budget rows exist',rows.every(Boolean));
 for(let i=0;i<rows.length;i++){
  const o=offers[i],row=rows[i],terms=keccak256(toUtf8Bytes(JSON.stringify([requestId,o.menu_id,o.venue_id,o.title,o.description,o.price,o.quantity,initial.request.pickup_by])));
  const orderId=keccak256(AbiCoder.defaultAbiCoder().encode(['address','bytes32'],[row.merchant,terms]));
  requireCheck(`terms and merchant-scoped ID match offer ${i+1}`,terms===row.terms_hash&&orderId===row.order_id&&Number((await chain.orders(orderId)).state)===0);
 }
 const outsiderAccept=await post({action:'accept',requestId,offerId:offers[0].id},'','outsider accept');check('outsider acceptance blocked 403',outsiderAccept.status===403,outsiderAccept);
 const acceptBurst=offers=>Array.from({length:12},(_,i)=>post({action:'accept',requestId,offerId:offers[i%offers.length].id},ownerCookie,`accept ${i+1}`));
 const accepting=acceptBurst(offers);
 // Queued behind the 12 requests: total concurrent HTTP never exceeds 12.
 const duringAcceptance=await view(ownerCookie,'observe acceptance');
 const acceptResults=await Promise.all(accepting);check('one successful acceptance among twelve',acceptResults.filter(r=>r.ok).length===1,acceptResults.map(r=>r.status));
 check('other acceptance attempts are rejected',acceptResults.filter(r=>!r.ok).every(r=>[400,409].includes(r.status)),acceptResults.map(r=>r.status));
 const accepted=await poll('accepted');chosen=accepted.offers.find(o=>o.id===accepted.request.chosen);report.offerId=chosen?.id;
 requireCheck('one chosen accepted offer; other offers cancelled',!!chosen&&chosen.status==='accepted'&&accepted.offers.filter(o=>o.status==='accepted').length===1&&accepted.offers.filter(o=>o.id!==chosen.id).every(o=>o.status==='cancelled'));
 check('reserving observed without pickup code',report.transitions.some(t=>t.status==='reserving'&&t.codeCount===0),report.transitions);
 requireCheck('owner code appears only once acceptance is confirmed',typeof chosen.code==='string'&&chosen.code.length===6&&accepted.offers.filter(o=>Object.hasOwn(o,'code')).length===1);
 const record=budgetRow(chosen.id),held=await chain.orders(record.order_id);report.onchain.orderId=record.order_id;report.onchain.held=plainOrder(held);
 requireCheck('matching order is Held on Fuji',Number(held.state)===1&&held.merchant.toLowerCase()===record.merchant.toLowerCase()&&held.beneficiary===beneficiary&&held.amount===BigInt(record.amount)&&held.termsHash===record.terms_hash&&Number(held.expiresAt)===record.expires_at);
 requireCheck('HTTP reports the verified budget hold',accepted.budgetSettlement?.state==='held'&&accepted.budgetSettlement.orderId===record.order_id&&accepted.budgetSettlement.contract.toLowerCase()===contractAddress.toLowerCase());
 const outsiderView=await view('','outsider accepted view');check('outsider GET has no code or ownership hash',outsiderView.ok&&outsiderView.data.mine===false&&noCodes(outsiderView.data)&&!Object.hasOwn(outsiderView.data.request,'owner_hash'));
 const beforeWrong=await account(record.merchant);
 const outsiderPickup=await post({action:'demoCollect',offerId:chosen.id,code:chosen.code},'','outsider pickup');check('outsider pickup blocked 403',outsiderPickup.status===403,outsiderPickup);
 const wrong=await post({action:'demoCollect',offerId:chosen.id,code:chosen.code==='AAAAAA'?'BBBBBB':'AAAAAA'},ownerCookie,'wrong pickup code');check('wrong pickup code rejected',wrong.status===400,wrong);
 const afterWrong=await account(record.merchant);check('unauthorized and wrong-code attempts move no funds',JSON.stringify(beforeWrong)===JSON.stringify(afterWrong)&&Number((await chain.orders(record.order_id)).state)===1,{before:beforeWrong,after:afterWrong});
 const collecting=Array.from({length:12},(_,i)=>post({action:'demoCollect',offerId:chosen.id,code:chosen.code},ownerCookie,`collect ${i+1}`));
 await view(ownerCookie,'observe settlement');const collectResults=await Promise.all(collecting);
 check('collection burst returns success or safe rejection',collectResults.some(r=>r.ok)&&collectResults.every(r=>r.ok||[400,409].includes(r.status)),collectResults.map(r=>r.status));
 const collected=await poll('collected'),finalOffer=collected.offers.find(o=>o.id===chosen.id),settled=await chain.orders(record.order_id);report.onchain.settled=plainOrder(settled);
 requireCheck('HTTP collected has the exact settled proof',collected.budgetSettlement?.state==='settled'&&Number(settled.state)===2&&finalOffer.proof_hash===settled.fulfilmentHash&&finalOffer.tx_hash===collected.budgetSettlement.settleTx);
 const proof=keccak256(toUtf8Bytes(JSON.stringify([chosen.id,chosen.code,chosen.price,chosen.created])));check('fulfilment hash binds chosen pickup',settled.fulfilmentHash===proof);
 const afterSettlement=await account(record.merchant);check('commission moves once from reserved to spent and credit',BigInt(afterSettlement.reserved)===BigInt(beforeWrong.reserved)-BigInt(record.amount)&&BigInt(afterSettlement.spent)===BigInt(beforeWrong.spent)+BigInt(record.amount)&&BigInt(afterSettlement.credits)===BigInt(beforeWrong.credits)+BigInt(record.amount),{before:beforeWrong,after:afterSettlement});
 for(const o of offers){const after=stock(o.menu_id);report.stock[o.menu_id].after=after;check(`stock changes exactly once for ${o.title}`,after===report.stock[o.menu_id].before-(o.id===chosen.id?1:0),report.stock[o.menu_id]);}
 const duplicate=await post({action:'demoCollect',offerId:chosen.id,code:chosen.code},ownerCookie,'duplicate collected pickup');check('duplicate collected pickup rejected',duplicate.status===400||duplicate.status===409,duplicate);
 await post({action:'syncBudget',requestId},ownerCookie,'idempotent final sync');
 check('repeated reconciliation does not decrement stock again',stock(chosen.menu_id)===report.stock[chosen.menu_id].after);
 const outsiderFinal=await view('','outsider collected view');check('outsider still cannot see code after collection',outsiderFinal.ok&&noCodes(outsiderFinal.data));
 const endBlock=await provider.getBlockNumber();report.onchain.toBlock=endBlock;
 const holdEvents=await chain.queryFilter(chain.filters.BudgetHeld(record.order_id),startBlock,endBlock),settleEvents=await chain.queryFilter(chain.filters.BudgetSettled(record.order_id),startBlock,endBlock);
 report.onchain.holdEvents=holdEvents.map(e=>({txHash:e.transactionHash,blockNumber:e.blockNumber}));report.onchain.settleEvents=settleEvents.map(e=>({txHash:e.transactionHash,blockNumber:e.blockNumber}));
 check('exactly one Hold and one Settlement event onchain',holdEvents.length===1&&settleEvents.length===1&&settleEvents[0].transactionHash===collected.budgetSettlement.settleTx);
 for(const row of rows.filter(r=>r.order_id!==record.order_id))check('unchosen offer has no onchain order',Number((await chain.orders(row.order_id)).state)===0);
 const jobs=sql.prepare('SELECT id,tx_hash FROM chain_jobs WHERE id IN (?,?)').all('hold:'+chosen.id,'settle:'+chosen.id);report.onchain.jobs=jobs;check('one durable job for each authorized chain operation',jobs.length===2&&new Set(jobs.map(j=>j.id)).size===2);
 check('HTTP concurrency stayed at twelve or below',report.maxHttpConcurrency<=12,report.maxHttpConcurrency);
 finished=true;
}catch(error){report.error=String(error);console.error(String(error));}
finally{
 // Only cancel an unchosen open test request; never discard an uncertain hold/settlement.
 if(requestId&&!finished){try{const current=await view();if(current.ok&&current.data.request.status==='open')report.cleanup=await post({action:'cancel',requestId},ownerCookie,'cancel unused test');else report.recovery={requestId,status:current.data?.request?.status,chosen:current.data?.request?.chosen,note:'Preserved for reconciliation; no second request created'};}catch(error){report.cleanupError=String(error);}}
 report.finishedAt=new Date().toISOString();report.passed=finished&&!report.error&&report.checks.every(c=>c.passed);save();sql.close();await provider.destroy();console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,resultPath,requestId,offerId:chosen?.id}));if(!report.passed)process.exitCode=1;
}
