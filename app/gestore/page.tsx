import {getChatGPTUser,chatGPTSignInPath} from '../chatgpt-auth';
import Merchant from './merchant';
import {Frame} from '../customer';
export const dynamic='force-dynamic';
export default async function Page(){const u=await getChatGPTUser();if(!u)return <Frame><main className="narrow"><span className="eyebrow">PER I LOCALI DI PESCARA</span><h1 className="top-margin">Il cliente ti dice<br/>quanto può spendere.</h1><p className="help">Tu proponi un piatto disponibile, con prezzo totale e ritiro. Puoi iniziare con un punto di prova: nessun pasto o pagamento reale.</p><a className="primary" href={chatGPTSignInPath('/gestore')} target="_top">Accedi con ChatGPT</a><p className="caption top-margin">L’accesso identifica chi gestisce il pannello; non certifica la titolarità dell’attività.</p></main></Frame>;return <Merchant/>}
