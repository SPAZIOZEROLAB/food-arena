import {BUDGET} from '../../budget-config';
import {budgetProvider,walletSnapshot} from '../../budget-server';
import proof from '../../budget-proof.json';
export async function GET(){
 const headers={'Cache-Control':'no-store','Content-Type':'application/json'};
 try{
  const evidence=proof as Record<string,any>;
  if(evidence.ready!==true||!evidence.merchant||evidence.contract!==BUDGET.contract)return Response.json({status:'not_ready',chainId:43113,proof:{tests:[]}},{headers});
  const provider=budgetProvider();
  if(Number(await provider.send('eth_chainId',[]))!==43113||await provider.getCode(BUDGET.contract)==='0x')throw Error('Unavailable chain');
  return Response.json({...evidence,...await walletSnapshot(evidence.merchant),status:'ready',checkedAt:Date.now()},{headers});
 }catch{return Response.json({status:'not_ready',error:'Lettura Fuji temporaneamente non disponibile.'},{status:503,headers})}
}
