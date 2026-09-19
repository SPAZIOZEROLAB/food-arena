import {env} from 'cloudflare:workers';
import {Contract,JsonRpcProvider,Wallet,formatEther,keccak256,toUtf8Bytes,verifyTypedData,verifyMessage,getAddress,AbiCoder} from 'ethers';
import {db} from '../db/raw';
import {BUDGET} from './budget-config';
import {BUDGET_ABI,CONFIG_TYPES,HOLD_TYPES,SETTLEMENT_TYPES} from './budget-abi';

type Row=Record<string,any>;
export const budgetDomain=()=>({name:'FoodArenaBudgetFuji',version:'1',chainId:BUDGET.chainId,verifyingContract:BUDGET.contract});
export const digest=(text:string)=>keccak256(toUtf8Bytes(text));
export const chainError=(message:string,status=409)=>Object.assign(new Error(message),{status});
export function budgetProvider(){if(/^0x0{40}$/i.test(BUDGET.contract))throw chainError('Il mandato Fuji è in preparazione.',503);return new JsonRpcProvider(BUDGET.rpc,BUDGET.chainId,{staticNetwork:true,cacheTimeout:-1})}
export function budgetContract(){return new Contract(BUDGET.contract,BUDGET_ABI,budgetProvider())}
function sponsor(){if(!env.FUJI_PRIVATE_KEY)throw chainError('Relayer di prova non disponibile.',503);return new Wallet(env.FUJI_PRIVATE_KEY)}
export function demoWallet(venue:string){const kind=['verde','bowl','forno'].find(k=>venue.startsWith('arena-demo-'+k+'-'));if(!kind)throw chainError('Locale di prova non riconosciuto.');return new Wallet(digest(sponsor().privateKey+':food-arena-budget-demo-v1:'+kind))}
export function makeHold(r:Row,o:Row,merchant:string){const termsHash=digest(JSON.stringify([r.id,o.menu_id,o.venue_id,o.title,o.description,o.price,o.quantity,r.pickup_by]));return {orderId:keccak256(AbiCoder.defaultAbiCoder().encode(['address','bytes32'],[merchant,termsHash])),merchant:getAddress(merchant),beneficiary:BUDGET.beneficiary,amount:BUDGET.commission,expiresAt:Math.floor(r.pickup_by/1000),termsHash}}
export function holdFromRow(o:Row){return {orderId:o.order_id,merchant:o.merchant,beneficiary:BUDGET.beneficiary,amount:o.amount,expiresAt:o.expires_at,termsHash:o.terms_hash}}
export function validSignature(types:any,payload:any,signature:unknown,address:string){try{return typeof signature==='string'&&signature.length===132&&verifyTypedData(budgetDomain(),types,payload,signature).toLowerCase()===address.toLowerCase()}catch{return false}}
export async function storeOfferBudget(r:Row,o:Row,address:string,signature:string){const h=makeHold(r,o,address);if(!validSignature(HOLD_TYPES,h,signature,address))throw chainError('La firma del mandato non corrisponde a questa offerta.',403);await db().prepare('INSERT INTO budget_offers(offer_id,order_id,merchant,amount,expires_at,terms_hash,signature,status) VALUES(?,?,?,?,?,?,?,?)').bind(o.id,h.orderId,h.merchant,h.amount,h.expiresAt,h.termsHash,signature,'offered').run()}
export async function signDemoOffer(r:Row,o:Row){const w=demoWallet(o.venue_id);const h=makeHold(r,o,w.address);await storeOfferBudget(r,o,w.address,await w.signTypedData(budgetDomain(),HOLD_TYPES,h))}

// A durable, signed transaction is persisted BEFORE broadcast. Retries rebroadcast
// identical bytes, never sign a second operation because an RPC response was lost.
// D1 lease serializes nonce allocation across Workers; raw transactions contain no key.
export async function sendBudgetTx(jobId:string,method:string,args:any[],value=0n):Promise<{pending:boolean,txHash?:string}>{
 const provider=budgetProvider(),wallet=sponsor(),contract=new Contract(BUDGET.contract,BUDGET_ABI,provider);
 const existing=await db().prepare('SELECT * FROM chain_jobs WHERE id=?').bind(jobId).first<Row>();
 if(existing){const receipt=await provider.getTransactionReceipt(existing.tx_hash);if(receipt){if(receipt.status!==1)throw chainError('Il contratto ha respinto la transazione. Nessuna commissione è stata addebitata.');return {pending:false,txHash:existing.tx_hash}}try{await provider.broadcastTransaction(existing.raw_tx)}catch{/* receipt may be propagating; same bytes remain recoverable */}return {pending:true,txHash:existing.tx_hash}}
 const holder=crypto.randomUUID(),now=Date.now();
 await db().prepare("INSERT OR IGNORE INTO chain_lease(id,holder,until) VALUES('sponsor','',0)").run();
 const lease=await db().prepare("UPDATE chain_lease SET holder=?,until=? WHERE id='sponsor' AND until<?").bind(holder,now+30000,now).run();
 if(!lease.meta.changes)return {pending:true};
 try{
  const recheck=await db().prepare('SELECT tx_hash FROM chain_jobs WHERE id=?').bind(jobId).first<Row>();if(recheck)return {pending:true,txHash:recheck.tx_hash};
  if(Number(await provider.send('eth_chainId',[]))!==43113)throw chainError('Operazione consentita soltanto su Fuji.',503);
  const rate=await db().prepare('INSERT INTO limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind('budget-relay:'+Math.floor(now/86400000),now+86400000).first<Row>();if(rate!.count>300)throw chainError('Limite giornaliero del relayer di prova raggiunto.',429);
  // Recover any prepared transaction before allocating subsequent nonces.
  const chainNonce=await provider.getTransactionCount(wallet.address,'latest');
  const recent=(await db().prepare('SELECT raw_tx,tx_hash FROM chain_jobs WHERE nonce>=? ORDER BY nonce').bind(chainNonce).all<Row>()).results;
  for(const job of recent){const renewed=await db().prepare("UPDATE chain_lease SET until=? WHERE id='sponsor' AND holder=? AND until>?").bind(Date.now()+30000,holder,Date.now()).run();if(!renewed.meta.changes)return {pending:true};if(!await provider.getTransactionReceipt(job.tx_hash)){try{await provider.broadcastTransaction(job.raw_tx)}catch{/* existing or temporarily unavailable */}}}
  const data=contract.interface.encodeFunctionData(method,args),transaction={to:BUDGET.contract,data,value,from:wallet.address};
  let gas:bigint;try{gas=await provider.estimateGas(transaction)}catch(e:any){if(e.code==='CALL_EXCEPTION')throw chainError('Il contratto ha respinto il mandato: controlla firma, limiti, fondi e scadenza.');throw e}
  gas=gas*125n/100n;if(gas>1000000n||value>BigInt(BUDGET.starterFund))throw chainError('Operazione oltre i limiti della prova.',403);
  const maxFeePerGas=25000000000n,maxPriorityFeePerGas=1000000000n;if(await provider.getBalance(wallet.address)<gas*maxFeePerGas+value)throw chainError('Fondi del relayer di prova esauriti.',503);
  const prior=await db().prepare('SELECT MAX(nonce) AS n FROM chain_jobs').first<Row>(),nonce=Math.max(await provider.getTransactionCount(wallet.address,'pending'),prior?.n==null?0:Number(prior.n)+1);
  const rawTx=await wallet.signTransaction({to:BUDGET.contract,data,value,chainId:43113,nonce,type:2,gasLimit:gas,maxFeePerGas,maxPriorityFeePerGas}),txHash=keccak256(rawTx);
  const saved=await db().prepare("INSERT OR IGNORE INTO chain_jobs(id,nonce,raw_tx,tx_hash,created) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM chain_lease WHERE id='sponsor' AND holder=? AND until>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER))").bind(jobId,nonce,rawTx,txHash,now,holder).run();if(!saved.meta.changes)return {pending:true};
  try{await provider.broadcastTransaction(rawTx)}catch{/* keep prepared transaction for an identical retry */}
  return {pending:true,txHash};
 }finally{await db().prepare("UPDATE chain_lease SET until=0 WHERE id='sponsor' AND holder=?").bind(holder).run()}
}

export async function walletSnapshot(address:string){const c=budgetContract(),m=await c.merchants(address),credits=await c.credits(m.beneficiary);return {merchant:address,beneficiary:m.beneficiary,availableAvax:formatEther(m.available),reservedAvax:formatEther(m.reserved),spentAvax:formatEther(m.spent),creditsAvax:formatEther(credits),configured:BigInt(m.perOrderLimit)>0n,configNonce:Number(m.configNonce),contract:BUDGET.contract,chainId:43113,commissionAvax:formatEther(BigInt(BUDGET.commission)),checkedAt:Date.now()}}
export async function settlementView(offerId:string){const o=await db().prepare('SELECT * FROM budget_offers WHERE offer_id=?').bind(offerId).first<Row>();if(!o)return null;try{const account=await walletSnapshot(o.merchant);return {...account,state:o.status==='settled'?'settled':o.status==='released'?'expired':['holding','settling','releasing'].includes(o.status)?'pending':o.status==='held'?'held':'none',holdTx:o.hold_tx,settleTx:o.settle_tx,releaseTx:o.release_tx,amountAvax:formatEther(BigInt(o.amount)),orderId:o.order_id}}catch{return {state:'pending',contract:BUDGET.contract,chainId:43113,merchant:o.merchant,amountAvax:formatEther(BigInt(o.amount)),holdTx:o.hold_tx,settleTx:o.settle_tx,releaseTx:o.release_tx,unavailable:true}}}
function sameOrder(chain:Row,o:Row){return chain.merchant.toLowerCase()===o.merchant.toLowerCase()&&chain.beneficiary.toLowerCase()===BUDGET.beneficiary.toLowerCase()&&chain.amount===BigInt(o.amount)&&chain.termsHash.toLowerCase()===o.terms_hash.toLowerCase()&&Number(chain.expiresAt)===o.expires_at}
export async function syncBudgetRequest(requestId:string){
 const r=await db().prepare('SELECT * FROM requests WHERE id=?').bind(requestId).first<Row>();if(!r?.chosen)return {pending:false};
 const o=await db().prepare('SELECT * FROM budget_offers WHERE offer_id=?').bind(r.chosen).first<Row>();if(!o)return {pending:false};
 const c=budgetContract();let chain=await c.orders(o.order_id);
 if(Number(chain.state)>0&&!sameOrder(chain,o))throw chainError('Stato onchain diverso dal mandato: verifica necessaria.',409);
 if(Number(chain.state)===1&&Math.floor(Date.now()/1000)>o.expires_at+2){const block=await budgetProvider().getBlock('latest');if(block&&block.timestamp>o.expires_at){const released=await sendBudgetTx('release:'+o.offer_id,'releaseExpired',[o.order_id]);await db().prepare("UPDATE budget_offers SET status='releasing',release_tx=COALESCE(?,release_tx) WHERE offer_id=? AND status IN ('held','holding','settling','releasing')").bind(released.txHash||null,o.offer_id).run();if(released.pending)return released;chain=await c.orders(o.order_id)}}
 if(r.status==='reserving'&&Number(chain.state)===0){
  try{const sent=await sendBudgetTx('hold:'+o.offer_id,'hold',[holdFromRow(o),o.signature]);if(sent.txHash)await db().prepare('UPDATE budget_offers SET hold_tx=? WHERE offer_id=?').bind(sent.txHash,o.offer_id).run();if(sent.pending)return sent;chain=await c.orders(o.order_id)}catch(e:any){if(e.status===409){await db().batch([db().prepare("UPDATE requests SET status='cancelled',chosen=NULL WHERE id=? AND chosen=? AND status='reserving'").bind(r.id,o.offer_id),db().prepare("UPDATE offers SET status='cancelled' WHERE request_id=? AND status IN ('reserving','offered')").bind(r.id),db().prepare("UPDATE budget_offers SET status='failed' WHERE offer_id=? AND status='holding'").bind(o.offer_id)]);}throw e}
 }
 if(Number(chain.state)===1&&r.status==='reserving'){
  await db().batch([db().prepare("UPDATE requests SET status='accepted' WHERE id=? AND chosen=? AND status='reserving'").bind(r.id,o.offer_id),db().prepare("UPDATE offers SET status='accepted' WHERE id=? AND status='reserving'").bind(o.offer_id),db().prepare("UPDATE offers SET status='cancelled' WHERE request_id=? AND id<>? AND status='offered'").bind(r.id,o.offer_id),db().prepare("UPDATE budget_offers SET status='held' WHERE offer_id=? AND status='holding'").bind(o.offer_id)]);return {pending:false};
 }
 if(Number(chain.state)===1&&r.status==='settling'){
  if(!o.settle_signature||!o.fulfilment_hash)throw chainError('Firma del ritiro mancante.',409);
  const payload={merchant:o.merchant,orderId:o.order_id,fulfilmentHash:o.fulfilment_hash,deadline:o.settle_deadline};
  const sent=await sendBudgetTx('settle:'+o.offer_id,'settle',[payload,o.settle_signature]);if(sent.txHash)await db().prepare('UPDATE budget_offers SET settle_tx=? WHERE offer_id=?').bind(sent.txHash,o.offer_id).run();if(sent.pending)return sent;chain=await c.orders(o.order_id);
 }
 if(Number(chain.state)===2){
  const offer=await db().prepare('SELECT * FROM offers WHERE id=?').bind(o.offer_id).first<Row>();
  await db().batch([db().prepare("UPDATE menu SET stock=stock-? WHERE id=? AND stock>=? AND EXISTS(SELECT 1 FROM offers WHERE id=? AND status='settling')").bind(offer!.quantity,offer!.menu_id,offer!.quantity,o.offer_id),db().prepare("UPDATE offers SET status='collected',proof_hash=?,tx_hash=? WHERE id=? AND status='settling' AND changes()>0").bind(chain.fulfilmentHash,o.settle_tx,o.offer_id),db().prepare("UPDATE requests SET status='collected' WHERE id=? AND EXISTS(SELECT 1 FROM offers WHERE id=? AND status='collected')").bind(r.id,o.offer_id),db().prepare("UPDATE budget_offers SET status='settled' WHERE offer_id=? AND EXISTS(SELECT 1 FROM offers WHERE id=? AND status='collected')").bind(o.offer_id,o.offer_id)]);const confirmed=await db().prepare('SELECT status FROM offers WHERE id=?').bind(o.offer_id).first<Row>();if(confirmed?.status!=='collected')throw chainError('Commissione regolata su Fuji; inventario da riconciliare. Nessun secondo addebito.',503);return {pending:false};
 }
 if(Number(chain.state)===3){await db().batch([db().prepare("UPDATE budget_offers SET status='released' WHERE offer_id=?").bind(o.offer_id),db().prepare("UPDATE offers SET status='cancelled' WHERE id=? AND status<>'collected'").bind(o.offer_id),db().prepare("UPDATE requests SET status='cancelled' WHERE id=? AND status<>'collected'").bind(r.id)]);return {pending:false};}
 return {pending:['reserving','settling'].includes(r.status)};
}
export async function startSettlement(r:Row,o:Row,signature?:string){const stored=await db().prepare('SELECT * FROM budget_offers WHERE offer_id=?').bind(o.id).first<Row>();if(!stored)throw chainError('Mandato assente: apri una nuova richiesta.');const payload={merchant:stored.merchant,orderId:stored.order_id,fulfilmentHash:digest(JSON.stringify([o.id,o.code,o.price,o.created])),deadline:stored.expires_at};if(!validSignature(SETTLEMENT_TYPES,payload,signature,stored.merchant))throw chainError('Il ritiro richiede la firma del gestore autorizzato.',403);await db().batch([db().prepare("UPDATE budget_offers SET status='settling',settle_signature=?,settle_deadline=?,fulfilment_hash=? WHERE offer_id=? AND status='held'").bind(signature!,payload.deadline,payload.fulfilmentHash,o.id),db().prepare("UPDATE requests SET status='settling' WHERE id=? AND status='accepted' AND chosen=?").bind(r.id,o.id),db().prepare("UPDATE offers SET status='settling' WHERE id=? AND status='accepted'").bind(o.id)]);return syncBudgetRequest(r.id)}
export async function settlementPayload(offerId:string){const o=await db().prepare('SELECT o.*,b.merchant,b.order_id,b.expires_at FROM offers o JOIN budget_offers b ON b.offer_id=o.id WHERE o.id=?').bind(offerId).first<Row>();if(!o)throw chainError('Mandato assente.');return {merchant:o.merchant,orderId:o.order_id,fulfilmentHash:digest(JSON.stringify([o.id,o.code,o.price,o.created])),deadline:o.expires_at}}
export async function setupMerchantBudget(venueId:string,address:string,signature:string,deadline:number,ownershipSignature:string){
 const normalized=getAddress(address),existing=await db().prepare('SELECT * FROM budget_wallets WHERE venue_id=?').bind(venueId).first<Row>();if(existing&&existing.address.toLowerCase()!==normalized.toLowerCase())throw chainError('Il locale ha già un diverso firmatario di prova.',409);
 const c=budgetContract(),m=await c.merchants(normalized),config={merchant:normalized,beneficiary:BUDGET.beneficiary,perOrderLimit:BUDGET.commission,lifetimeLimit:BUDGET.lifetime,nonce:0,deadline};
 // Proof of ownership is mandatory even if this wallet was configured independently.
 if(!validSignature(CONFIG_TYPES,config,signature,normalized))throw chainError('Firma del gestore non valida.',403);
 const ownership=`Food Arena · collega mandato di prova\nLocale: ${venueId}\nWallet: ${normalized}\nRete: 43113\nContratto: ${BUDGET.contract}\nScadenza: ${deadline}`;try{if(verifyMessage(ownership,ownershipSignature).toLowerCase()!==normalized.toLowerCase())throw Error()}catch{throw chainError('Collegamento del wallet al locale non autorizzato.',403)}
 if(BigInt(m.perOrderLimit)>0n&&(m.beneficiary.toLowerCase()!==BUDGET.beneficiary.toLowerCase()||BigInt(m.perOrderLimit)!==BigInt(BUDGET.commission)||BigInt(m.lifetimeLimit)!==BigInt(BUDGET.lifetime)))throw chainError('Il wallet contiene un diverso mandato. Usa il mandato Food Arena previsto.',409);
 if(!existing)await db().prepare('INSERT INTO budget_wallets(venue_id,address,created) VALUES(?,?,?)').bind(venueId,normalized,Date.now()).run();
 if(BigInt(m.perOrderLimit)===0n){const configured=await sendBudgetTx('configure:'+venueId,'configure',[config,signature]);if(configured.pending)return configured;}
 const funded=await sendBudgetTx('fund:'+venueId,'depositFor',[normalized],BigInt(BUDGET.starterFund));return funded;
}
