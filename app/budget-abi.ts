import { AbiCoder, getAddress, keccak256 } from 'ethers';

export const BUDGET_CHAIN_ID = 43113;
export const BUDGET_ORDER_STATE = { None: 0, Held: 1, Settled: 2, Released: 3 } as const;
export const BUDGET_LIMITS = { maxPerOrder: 1_000_000_000_000_000n, maxLifetime: 100_000_000_000_000_000n, maxHoldSeconds: 86400 } as const;
export const budgetDomain = (chainId: number | bigint, verifyingContract: string) => ({ name: 'FoodArenaBudgetFuji', version: '1', chainId, verifyingContract: getAddress(verifyingContract) });
// termsHash must commit to the request UUID and every immutable accepted term.
export const budgetOrderId = (merchant: string, termsHash: string) => keccak256(AbiCoder.defaultAbiCoder().encode(['address','bytes32'],[getAddress(merchant),termsHash]));

type Fields = Array<{name: string; type: string}>;
export const BUDGET_TYPES: Record<string, Fields> = {
  Config: [{name:'merchant',type:'address'},{name:'beneficiary',type:'address'},{name:'perOrderLimit',type:'uint256'},{name:'lifetimeLimit',type:'uint256'},{name:'nonce',type:'uint256'},{name:'deadline',type:'uint256'}],
  Hold: [{name:'orderId',type:'bytes32'},{name:'merchant',type:'address'},{name:'beneficiary',type:'address'},{name:'amount',type:'uint256'},{name:'expiresAt',type:'uint64'},{name:'termsHash',type:'bytes32'}],
  Settlement: [{name:'merchant',type:'address'},{name:'orderId',type:'bytes32'},{name:'fulfilmentHash',type:'bytes32'},{name:'deadline',type:'uint256'}],
  Withdraw: [{name:'merchant',type:'address'},{name:'amount',type:'uint256'},{name:'nonce',type:'uint256'},{name:'deadline',type:'uint256'}],
};
// Pass only the intended primary type to signTypedData/verifyTypedData.
export const budgetTypes = (primaryType: 'Config' | 'Hold' | 'Settlement' | 'Withdraw') => ({[primaryType]: BUDGET_TYPES[primaryType]});
export const CONFIG_TYPES = budgetTypes('Config');
export const HOLD_TYPES = budgetTypes('Hold');
export const SETTLEMENT_TYPES = budgetTypes('Settlement');
export const WITHDRAW_TYPES = budgetTypes('Withdraw');

export const BUDGET_ERROR_MESSAGES: Record<string, string> = {
  WrongChain: 'Usa Avalanche Fuji o una rete locale di test.',
  InvalidAddress: 'Indirizzo del gestore o beneficiario non valido, oppure beneficiario cambiato: firma nuovamente i termini.',
  InvalidSignature: 'Autorizzazione del gestore non valida per questa operazione.',
  ExpiredSignature: 'Autorizzazione scaduta: conferma nuovamente dal dispositivo del gestore.',
  InvalidNonce: 'Questa autorizzazione è già stata usata o la configurazione è cambiata.',
  InvalidLimits: 'Limiti del budget di prova non validi.',
  InvalidAmount: 'Importo non valido o superiore al limite per ordine.',
  NotConfigured: 'Il gestore deve prima autorizzare il budget di prova.',
  InsufficientAvailable: 'Budget disponibile insufficiente; le somme riservate non sono prelevabili.',
  LifetimeLimit: 'Il limite complessivo autorizzato del gestore è raggiunto.',
  OrderAlreadyExists: 'Ordine già registrato: verifica il suo stato onchain.',
  InvalidOrder: 'Ordine assente, già completato o non appartenente al gestore.',
  InvalidExpiry: 'La riserva è scaduta o la sua durata non è valida.',
  InvalidCommitment: 'Impronta dei termini o della consegna non valida.',
  TransferFailed: 'Trasferimento non riuscito; il saldo resta disponibile.',
  ReentrantCall: 'Operazione concorrente non consentita.',
};

export type BudgetConfig = {merchant:string;beneficiary:string;perOrderLimit:bigint|string; lifetimeLimit:bigint|string;nonce:bigint|string|number;deadline:bigint|string|number};
export type BudgetHold = {orderId:string;merchant:string;beneficiary:string;amount:bigint|string;expiresAt:bigint|string|number;termsHash:string};
export type BudgetSettlement = {merchant:string;orderId:string;fulfilmentHash:string;deadline:bigint|string|number};
export type BudgetWithdraw = {merchant:string;amount:bigint|string;nonce:bigint|string|number;deadline:bigint|string|number};

export const BUDGET_ABI = [
  'function configure((address merchant,address beneficiary,uint256 perOrderLimit,uint256 lifetimeLimit,uint256 nonce,uint256 deadline) c,bytes signature)',
  'function depositFor(address merchant) payable',
  'function hold((bytes32 orderId,address merchant,address beneficiary,uint256 amount,uint64 expiresAt,bytes32 termsHash) h,bytes signature)',
  'function settle((address merchant,bytes32 orderId,bytes32 fulfilmentHash,uint256 deadline) p,bytes signature)',
  'function releaseExpired(bytes32 orderId)',
  'function withdrawAvailable(uint256 amount)',
  'function withdrawAvailable((address merchant,uint256 amount,uint256 nonce,uint256 deadline) w,bytes signature)',
  'function claim()',
  'function merchants(address) view returns(address beneficiary,uint256 perOrderLimit,uint256 lifetimeLimit,uint256 available,uint256 reserved,uint256 spent,uint256 configNonce,uint256 withdrawNonce)',
  'function orders(bytes32) view returns(address merchant,address beneficiary,uint256 amount,uint64 expiresAt,bytes32 termsHash,bytes32 fulfilmentHash,uint8 state)',
  'function credits(address) view returns(uint256)',
  'function totalAvailable() view returns(uint256)',
  'function totalReserved() view returns(uint256)',
  'function totalCredits() view returns(uint256)',
  'function domainSeparator() view returns(bytes32)',
  'function MAX_PER_ORDER() view returns(uint256)',
  'function MAX_LIFETIME() view returns(uint256)',
  'function MAX_HOLD_SECONDS() view returns(uint256)',
  'event Configured(address indexed merchant,address beneficiary,uint256 perOrderLimit,uint256 lifetimeLimit,uint256 nonce)',
  'event Funded(address indexed merchant,address indexed donor,uint256 amount)',
  'event BudgetHeld(bytes32 indexed orderId,address indexed merchant,address indexed beneficiary,uint256 amount,uint64 expiresAt,bytes32 termsHash)',
  'event BudgetSettled(bytes32 indexed orderId,address indexed merchant,address indexed beneficiary,uint256 amount,bytes32 fulfilmentHash)',
  'event BudgetReleased(bytes32 indexed orderId,address indexed merchant,uint256 amount)',
  'event AvailableWithdrawn(address indexed merchant,uint256 amount)',
  'event CreditClaimed(address indexed beneficiary,uint256 amount)',
  ...['WrongChain','InvalidAddress','InvalidSignature','ExpiredSignature','InvalidNonce','InvalidLimits','InvalidAmount','NotConfigured','InsufficientAvailable','LifetimeLimit','OrderAlreadyExists','InvalidOrder','InvalidExpiry','InvalidCommitment','TransferFailed','ReentrantCall'].map(name => `error ${name}()`),
] as const;
