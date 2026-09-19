import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const dir=path.dirname(fileURLToPath(import.meta.url));
const option=name=>{const i=process.argv.indexOf('--'+name);return i<0?undefined:process.argv[i+1];};
const repoRoot=path.resolve(dir,option('source-root')||'../..');
const outputDir=path.join(dir,'.test-output');fs.mkdirSync(outputDir,{recursive:true});
const dep=createRequire(import.meta.url);
const solc=dep('solc'),ganache=dep('ganache'),ethers=dep('ethers'),ts=dep('typescript');
const {BrowserProvider,Wallet,ContractFactory,Interface,parseEther,id,ZeroAddress}=ethers;
const rawTs=fs.readFileSync(path.join(repoRoot,'app','budget-abi.ts'),'utf8');
const ethersEntry=pathToFileURL(dep.resolve('ethers')).href;
const runtime=ts.transpileModule(rawTs,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from ['"]ethers['"]/g,`from '${ethersEntry}'`);
fs.writeFileSync(path.join(outputDir,'budget-abi.test-runtime.mjs'),runtime);
const shared=await import('./.test-output/budget-abi.test-runtime.mjs');
const source=fs.readFileSync(path.join(repoRoot,'contracts','FoodArenaBudgetFuji.sol'),'utf8');
const probe=`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface Budget { function claim() external; }
contract ClaimProbe {
 Budget public budget; bool public rejectPayment; bool public reentryRejected;
 constructor(address target) { budget=Budget(target); }
 function setReject(bool value) external { rejectPayment=value; }
 function collect() external { budget.claim(); }
 receive() external payable {
   require(!rejectPayment, "test recipient rejects");
   try budget.claim() { revert("reentry unexpectedly succeeded"); } catch { reentryRejected=true; }
 }
}`;
const compiled=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'FoodArenaBudgetFuji.sol':{content:source},'ClaimProbe.sol':{content:probe}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}})));
const errors=(compiled.errors||[]).filter(e=>e.severity==='error');assert.equal(errors.length,0,errors.map(e=>e.formattedMessage).join('\n'));
const artifact=compiled.contracts['FoodArenaBudgetFuji.sol'].FoodArenaBudgetFuji;
const artifactOutput={contractName:'FoodArenaBudgetFuji',compiler:solc.version(),optimizer:{enabled:true,runs:200},evmVersion:'paris',sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),abi:artifact.abi,bytecode:'0x'+artifact.evm.bytecode.object,deployedBytecode:'0x'+artifact.evm.deployedBytecode.object};
fs.writeFileSync(path.join(outputDir,'FoodArenaBudgetFuji.json'),JSON.stringify(artifactOutput,null,2));
const abi=new Interface(shared.BUDGET_ABI),canonical=new Interface(artifact.abi);
for(const fragment of abi.fragments) if(['function','event','error'].includes(fragment.type)) {
 const match=canonical.fragments.find(f=>f.type===fragment.type&&f.format('sighash')===fragment.format('sighash'));
 assert.ok(match,'ABI mismatch '+fragment.format());
 if(fragment.type==='function') assert.deepEqual(fragment.outputs.map(p=>p.format('full')),match.outputs.map(p=>p.format('full')),'ABI return tuple mismatch '+fragment.name);
 if(fragment.type==='event') assert.deepEqual(fragment.inputs.map(p=>Boolean(p.indexed)),match.inputs.map(p=>Boolean(p.indexed)),'ABI event indexing mismatch '+fragment.name);
}

const results=[];const started=Date.now();
async function check(name,fn){const t=Date.now();await fn();results.push({name,passed:true,ms:Date.now()-t});console.log('PASS '+name);}
async function expectFail(promise){await assert.rejects(async()=>{const value=await promise;if(value&&typeof value.wait==='function')await value.wait();});}
const g=ganache.provider({logging:{quiet:true},chain:{chainId:31337},wallet:{totalAccounts:20,defaultBalance:100},miner:{instamine:'eager'}});
const provider=new BrowserProvider(g,undefined,{cacheTimeout:-1});
const addresses=await g.request({method:'eth_accounts',params:[]});
const initial=g.getInitialAccounts();
const wallets=addresses.map(a=>new Wallet(initial[a].secretKey));
const signers=await Promise.all(addresses.map(a=>provider.getSigner(a)));
const unit=parseEther('0.0001');
const now=async()=>Number((await g.request({method:'eth_getBlockByNumber',params:['latest',false]})).timestamp);
const fresh=async()=>{const c=await new ContractFactory(artifact.abi,artifactOutput.bytecode,signers[0]).deploy();await c.waitForDeployment();return c;};
const domain=c=>shared.budgetDomain(31337,c.target);
const sign=(c,type,payload,wallet=wallets[1],overrides={})=>wallet.signTypedData({...domain(c),...overrides},shared.budgetTypes(type),payload);
const conf=async(c,changes={},wallet=wallets[1])=>{const merchant=wallet.address;const m=await c.merchants(merchant);return {merchant,beneficiary:wallets[2].address,perOrderLimit:parseEther('0.001'),lifetimeLimit:parseEther('0.01'),nonce:m.configNonce,deadline:(await now())+3600,...changes};};
const configure=async(c,changes={},wallet=wallets[1])=>{const v=await conf(c,changes,wallet);await(await c.configure(v,await sign(c,'Config',v,wallet))).wait();return v;};
const fund=async(c,amount,merchant=wallets[1].address)=>await(await c.connect(signers[3]).depositFor(merchant,{value:amount})).wait();
let serial=0;
const holdData=async(changes={})=>{
 const h={merchant:wallets[1].address,beneficiary:wallets[2].address,amount:unit,expiresAt:(await now())+3600,termsHash:id('immutable accepted terms, request test-'+(++serial)),...changes};
 return {orderId:shared.budgetOrderId(h.merchant,h.termsHash),...h};
};
const hold=async(c,changes={},wallet=wallets[1])=>{const configured=await c.merchants(changes.merchant||wallet.address);const h=await holdData({merchant:wallet.address,beneficiary:configured.beneficiary,...changes});await(await c.hold(h,await sign(c,'Hold',h,wallet))).wait();return h;};
const settlement=async(h,changes={})=>({merchant:h.merchant,orderId:h.orderId,fulfilmentHash:id('pickup verified '+h.orderId),deadline:(await now())+600,...changes});
const invariant=async(c,merchantList=[wallets[1].address],beneficiaries=[wallets[2].address])=>{
 let a=0n,r=0n,cr=0n;for(const merchant of merchantList){const m=await c.merchants(merchant);a+=m.available;r+=m.reserved;assert.ok(m.spent+m.reserved<=m.lifetimeLimit||m.beneficiary===ZeroAddress);}
 for(const beneficiary of beneficiaries)cr+=await c.credits(beneficiary);
 assert.equal(await c.totalAvailable(),a);assert.equal(await c.totalReserved(),r);assert.equal(await c.totalCredits(),cr);
 const balance=BigInt(await g.request({method:'eth_getBalance',params:[c.target,'latest']}));assert.equal(balance,a+r+cr);
};

try {
await check('shared ABI, domain separator and source compile',async()=>{const c=await fresh();assert.equal(await c.domainSeparator(),ethers.TypedDataEncoder.hashDomain(domain(c)));assert.ok(artifact.evm.deployedBytecode.object.length/2<24576);});
await check('config merchant signature, nonce replay, domain and bounds',async()=>{
 const c=await fresh(),v=await conf(c);
 await expectFail(c.configure(v,await sign(c,'Config',v,wallets[0])));
 await expectFail(c.configure(v,await sign(c,'Config',v,wallets[1],{chainId:43113})));
 await expectFail(c.configure(v,await sign(c,'Config',v,wallets[1],{verifyingContract:wallets[19].address})));
 const good=await sign(c,'Config',v);
 const parsed=ethers.Signature.from(good),order=0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
 const highS=ethers.concat([parsed.r,ethers.toBeHex(order-BigInt(parsed.s),32),ethers.toBeHex(parsed.v===27?28:27,1)]);
 for(const malformed of ['0x',good.slice(0,-2),highS,good.slice(0,-2)+'00']) await expectFail(c.configure(v,malformed));
 await(await c.configure(v,good)).wait();await expectFail(c.configure(v,good));
 for(const changes of [{perOrderLimit:parseEther('0.0011')},{lifetimeLimit:parseEther('0.101')},{beneficiary:ZeroAddress},{deadline:(await now())-1}]){const bad=await conf(c,changes);await expectFail(c.configure(bad,await sign(c,'Config',bad)));}
 await invariant(c);
});
await check('gift deposit gives donor/relayer no withdrawal authority',async()=>{
 const c=await fresh();await fund(c,3n*unit);await expectFail(c.connect(signers[3])['withdrawAvailable(uint256)'](unit));
 const w={merchant:wallets[1].address,amount:unit,nonce:0,deadline:(await now())+3600};await expectFail(c['withdrawAvailable((address,uint256,uint256,uint256),bytes)'](w,await sign(c,'Withdraw',w,wallets[0])));
 await(await c.connect(signers[1])['withdrawAvailable(uint256)'](unit)).wait();assert.equal((await c.merchants(wallets[1].address)).available,2n*unit);await invariant(c);
});
await check('hold binds amount, terms, merchant, domain and merchant-scoped order ID',async()=>{
 const c=await fresh();await configure(c);await fund(c,8n*unit);const h=await holdData();const sig=await sign(c,'Hold',h);
 for(const changed of [{...h,amount:2n*unit},{...h,termsHash:id('changed euro price')},{...h,merchant:wallets[4].address},{...h,beneficiary:wallets[4].address}])await expectFail(c.hold(changed,sig));
 await expectFail(c.hold(h,await sign(c,'Hold',h,wallets[0])));
 await expectFail(c.hold(h,await sign(c,'Hold',h,wallets[1],{chainId:43114})));
 await(await c.hold(h,sig)).wait();await expectFail(c.hold(h,sig));
 await configure(c,{},wallets[4]);await fund(c,unit,wallets[4].address);
 const victim=await holdData();const attacker={...victim,merchant:wallets[4].address};
 await expectFail(c.hold(attacker,await sign(c,'Hold',attacker,wallets[4])));assert.equal((await c.orders(victim.orderId)).state,0n);
 await(await c.hold(victim,await sign(c,'Hold',victim))).wait();
 const own={...attacker,orderId:shared.budgetOrderId(attacker.merchant,attacker.termsHash)};
 await(await c.hold(own,await sign(c,'Hold',own,wallets[4]))).wait();assert.notEqual(own.orderId,victim.orderId);
 await invariant(c,[wallets[1].address,wallets[4].address]);
});
await check('12 concurrent holds against funds for 5: exactly 5 succeeds',async()=>{
 const c=await fresh();await configure(c);await fund(c,5n*unit);
 const inputs=await Promise.all(Array.from({length:12},()=>holdData()));const signatures=await Promise.all(inputs.map(h=>sign(c,'Hold',h)));
 const outcomes=await Promise.allSettled(inputs.map(async(h,i)=>{const tx=await c.connect(signers[i+5]).hold(h,signatures[i],{gasLimit:500000});return await tx.wait();}));
 assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,5);assert.equal(outcomes.filter(o=>o.status==='rejected').length,7);
 const m=await c.merchants(wallets[1].address);assert.equal(m.available,0n);assert.equal(m.reserved,5n*unit);await invariant(c);
});
await check('config changes preserve reserved+spent and fixed old beneficiary',async()=>{
 const c=await fresh();await configure(c);await fund(c,5n*unit);const h=await hold(c,{amount:3n*unit});
 let v=await conf(c,{perOrderLimit:unit,lifetimeLimit:2n*unit});await expectFail(c.configure(v,await sign(c,'Config',v)));
 await configure(c,{beneficiary:wallets[4].address,perOrderLimit:unit,lifetimeLimit:5n*unit});
 const p=await settlement(h);await(await c.settle(p,await sign(c,'Settlement',p))).wait();
 assert.equal(await c.credits(wallets[2].address),3n*unit);assert.equal(await c.credits(wallets[4].address),0n);
 v=await conf(c,{perOrderLimit:unit,lifetimeLimit:2n*unit});await expectFail(c.configure(v,await sign(c,'Config',v)));
 await invariant(c,[wallets[1].address],[wallets[2].address,wallets[4].address]);
});
await check('beneficiary change cannot redirect a previously signed unsubmitted hold',async()=>{
 const c=await fresh();await configure(c);await fund(c,unit);const h=await holdData(),sig=await sign(c,'Hold',h);
 await configure(c,{beneficiary:wallets[4].address});await expectFail(c.hold(h,sig));
 const redirected={...h,beneficiary:wallets[4].address};await expectFail(c.hold(redirected,sig));
 assert.equal((await c.orders(h.orderId)).state,0n);assert.equal((await c.merchants(h.merchant)).available,unit);
 await(await c.hold(redirected,await sign(c,'Hold',redirected))).wait();assert.equal((await c.orders(h.orderId)).beneficiary,wallets[4].address);
 await invariant(c,[wallets[1].address],[wallets[2].address,wallets[4].address]);
});
await check('settlement requires separate merchant signature; simultaneous replay is single-use',async()=>{
 const c=await fresh();await configure(c);await fund(c,2n*unit);const h=await hold(c);const p=await settlement(h);
 await expectFail(c.settle(p,await sign(c,'Settlement',p,wallets[0])));
 await expectFail(c.settle(p,await sign(c,'Hold',h)));
 const expired={...p,deadline:(await now())-1};await expectFail(c.settle(expired,await sign(c,'Settlement',expired)));
 const sig=await sign(c,'Settlement',p);await expectFail(c.settle({...p,fulfilmentHash:id('tamper')},sig));
 const outcomes=await Promise.allSettled([0,3].map(async i=>(await c.connect(signers[i]).settle(p,sig,{gasLimit:300000})).wait()));assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal((await c.orders(h.orderId)).state,2n);assert.equal((await c.merchants(h.merchant)).spent,unit);await invariant(c);
});
await check('beneficiary pull only, withdrawal cannot touch held funds, permit withdrawal replay',async()=>{
 const c=await fresh();await configure(c);await fund(c,4n*unit);const h=await hold(c,{amount:2n*unit});
 await expectFail(c.connect(signers[1])['withdrawAvailable(uint256)'](3n*unit));
 const w={merchant:wallets[1].address,amount:unit,nonce:0,deadline:(await now())+1000};const sig=await sign(c,'Withdraw',w);
 const expired={...w,deadline:(await now())-1};await expectFail(c['withdrawAvailable((address,uint256,uint256,uint256),bytes)'](expired,await sign(c,'Withdraw',expired)));
 await expectFail(c['withdrawAvailable((address,uint256,uint256,uint256),bytes)']({...w,amount:2n*unit},sig));
 const before=BigInt(await g.request({method:'eth_getBalance',params:[wallets[1].address,'latest']}));
 await(await c['withdrawAvailable((address,uint256,uint256,uint256),bytes)'](w,sig)).wait();assert.equal(BigInt(await g.request({method:'eth_getBalance',params:[wallets[1].address,'latest']})),before+unit);await expectFail(c['withdrawAvailable((address,uint256,uint256,uint256),bytes)'](w,sig));
 const p=await settlement(h);await(await c.settle(p,await sign(c,'Settlement',p))).wait();await expectFail(c.claim());await expectFail(c.connect(signers[1]).claim());
 const b=BigInt(await g.request({method:'eth_getBalance',params:[wallets[2].address,'latest']}));const tx=await c.connect(signers[2]).claim();const receipt=await tx.wait();const after=BigInt(await g.request({method:'eth_getBalance',params:[wallets[2].address,'latest']}));assert.equal(after-b+receipt.fee,2n*unit);assert.equal(await c.credits(wallets[2].address),0n);await expectFail(c.connect(signers[2]).claim());await invariant(c);
});
await check('expiry boundary restores funds once; old order cannot be reused',async()=>{
 const c=await fresh();await configure(c);await fund(c,unit);const h=await hold(c,{expiresAt:(await now())+30});await expectFail(c.releaseExpired(h.orderId));
 await g.request({method:'evm_increaseTime',params:[30]});await g.request({method:'evm_mine',params:[]});
 const p=await settlement(h);await expectFail(c.settle(p,await sign(c,'Settlement',p)));
 await(await c.connect(signers[8]).releaseExpired(h.orderId)).wait();await expectFail(c.releaseExpired(h.orderId));assert.equal((await c.orders(h.orderId)).state,3n);
 const reused={...h,expiresAt:(await now())+1000};await expectFail(c.hold(reused,await sign(c,'Hold',reused)));await invariant(c);
});
await check('per-order/lifetime and maximum 1 day enforce independent funding limits',async()=>{
 const c=await fresh();await configure(c,{perOrderLimit:unit,lifetimeLimit:2n*unit});await fund(c,10n*unit);
 for(const changes of [{amount:2n*unit},{expiresAt:(await now())+86410},{expiresAt:await now()}]){const h=await holdData(changes);await expectFail(c.hold(h,await sign(c,'Hold',h)));}
 const first=await hold(c);await hold(c);const third=await holdData();await expectFail(c.hold(third,await sign(c,'Hold',third)));
 const p=await settlement(first);await(await c.settle(p,await sign(c,'Settlement',p))).wait();await expectFail(c.hold(third,await sign(c,'Hold',third)));await invariant(c);
});
await check('claim resists reentrancy and recipient rejection preserves credit',async()=>{
 const c=await fresh(),pa=compiled.contracts['ClaimProbe.sol'].ClaimProbe;const probe=await new ContractFactory(pa.abi,'0x'+pa.evm.bytecode.object,signers[0]).deploy(c.target);await probe.waitForDeployment();
 await configure(c,{beneficiary:probe.target});await fund(c,unit);const h=await hold(c);const p=await settlement(h);await(await c.settle(p,await sign(c,'Settlement',p))).wait();
 await(await probe.setReject(true)).wait();await expectFail(probe.collect());assert.equal(await c.credits(probe.target),unit);
 await(await probe.setReject(false)).wait();await(await probe.collect()).wait();assert.equal(await probe.reentryRejected(),true);assert.equal(await c.credits(probe.target),0n);await invariant(c,[wallets[1].address],[probe.target]);
});
await check('mainnet 43114 deployment refused',async()=>{
 const main=ganache.provider({logging:{quiet:true},chain:{chainId:43114}}),mp=new BrowserProvider(main,undefined,{cacheTimeout:-1});try{const signer=await mp.getSigner();await expectFail((async()=>{const c=await new ContractFactory(artifact.abi,artifactOutput.bytecode,signer).deploy({gasLimit:6000000});await c.waitForDeployment();})());}finally{await mp.destroy();await main.disconnect();}
});
const summary={passed:true,testCount:results.length,durationMs:Date.now()-started,compiler:solc.version(),runtimeBytes:artifact.evm.deployedBytecode.object.length/2,sourceSha256:artifactOutput.sourceSha256,results,noDeployment:'Ganache in-memory only; no remote transaction sent'};
fs.writeFileSync(path.join(outputDir,'test-results.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({passed:true,testCount:results.length,durationMs:summary.durationMs,runtimeBytes:summary.runtimeBytes}));
}catch(error){fs.writeFileSync(path.join(outputDir,'test-results.json'),JSON.stringify({passed:false,results,error:String(error),stack:error.stack},null,2));throw error;}finally{await provider.destroy();await g.disconnect();}
