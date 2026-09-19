import {Contract,JsonRpcProvider,Wallet} from 'ethers';
export const FUJI={chainId:43113,contract:'0xC423398Cb6208285f5B596b7d8b26A60748953c0',rpc:'https://api.avax-test.network/ext/bc/C/rpc',fromBlock:58481711};
export const ABI=['function register(bytes32 requestCommitment,bytes32 receiptCommitment)','function receipts(address merchant,bytes32 requestCommitment) view returns(bytes32)','event PickupRegistered(address indexed merchant,bytes32 indexed requestCommitment,bytes32 receiptCommitment)'];
export async function publishReceipt(privateKey:string,requestHash:string,receiptHash:string,existingTx?:string){
 const provider=new JsonRpcProvider(FUJI.rpc,FUJI.chainId,{staticNetwork:true});const wallet=new Wallet(privateKey,provider);const contract=new Contract(FUJI.contract,ABI,wallet);
 if(Number((await provider.getNetwork()).chainId)!==FUJI.chainId)throw new Error('Rete diversa da Fuji.');
 if(existingTx){const receipt=await provider.getTransactionReceipt(existingTx);if(receipt?.status===1)return {txHash:existingTx,confirmed:true,signer:wallet.address};if(receipt?.status===0)throw new Error('Transazione fallita.');return {txHash:existingTx,confirmed:false,signer:wallet.address}}
 const old=await contract.receipts(wallet.address,requestHash);if(old.toLowerCase()===receiptHash.toLowerCase()){
  const logs=await contract.queryFilter(contract.filters.PickupRegistered(wallet.address,requestHash),FUJI.fromBlock);if(logs.length)return {txHash:logs[0].transactionHash,confirmed:true,signer:wallet.address};throw new Error('Impronta presente; recupero della transazione non disponibile.');
 }
 const tx=await contract.register(requestHash,receiptHash,{gasLimit:BigInt(100000),maxFeePerGas:BigInt(25000000000),maxPriorityFeePerGas:BigInt(1000000000),value:BigInt(0)});
 return {txHash:tx.hash,confirmed:false,signer:wallet.address};
}
