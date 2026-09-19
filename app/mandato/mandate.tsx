'use client';

import {useEffect, useState} from 'react';
import {ArrowUpRight, Check, Clock3, ShieldCheck, X} from 'lucide-react';
import {Frame} from '../customer';

type TestProof = {name: string; passed: boolean; evidence?: unknown};
type BudgetProof = {
  contract?: string;
  chainId?: number;
  merchant?: string;
  relayer?: string;
  beneficiary?: string;
  availableAvax?: string | number;
  reservedAvax?: string | number;
  spentAvax?: string | number;
  creditsAvax?: string | number;
  proof?: {
    tests?: TestProof[];
    fundTx?: string;
    holdTx?: string;
    settleTx?: string;
    releaseTx?: string;
    claimTx?: string;
  };
  status?: 'ready' | 'not_ready';
};

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const TX = /^0x[0-9a-fA-F]{64}$/;
const explorer = 'https://build.avax.network/explorer/fuji/c-chain';
const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;

function amount(value: unknown) {
  const raw = typeof value === 'number' && Number.isFinite(value) ? String(value) : typeof value === 'string' ? value : '';
  if (!/^\d+(\.\d+)?$/.test(raw) || raw.length > 60) return '—';
  const [whole, fraction] = raw.split('.');
  const decimals = fraction?.replace(/0+$/, '');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (decimals ? `,${decimals}` : '');
}

function ChainLink({value, kind, label}: {value?: string; kind: 'address' | 'tx'; label?: string}) {
  if (!value || !(kind === 'address' ? ADDRESS : TX).test(value)) return <span className="mandate-missing">In attesa della prova</span>;
  return <a className="mandate-chain-link" href={`${explorer}/${kind}/${value}`} target="_blank" rel="noopener noreferrer" title={value}>
    {label || short(value)}<ArrowUpRight size={15} aria-hidden="true" />
  </a>;
}

function Evidence({value}: {value: unknown}) {
  if (typeof value === 'string') {
    if (TX.test(value)) return <ChainLink value={value} kind="tx" label="Apri transazione" />;
    return <span className="mandate-test-detail">{value.slice(0, 360)}</span>;
  }
  if (value && typeof value === 'object') {
    const item = value as {txHash?: unknown; transactionHash?: unknown; message?: unknown};
    const hash = typeof item.txHash === 'string' ? item.txHash : typeof item.transactionHash === 'string' ? item.transactionHash : '';
    if (TX.test(hash)) return <ChainLink value={hash} kind="tx" label="Apri transazione" />;
    if (typeof item.message === 'string') return <span className="mandate-test-detail">{item.message.slice(0, 360)}</span>;
  }
  return null;
}

export default function Mandate() {
  const [data, setData] = useState<BudgetProof | null>(null);
  const [error, setError] = useState(false);
  const [readAt, setReadAt] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    async function load() {
      controller = new AbortController();
      try {
        const response = await fetch('/api/budget?view=proof', {cache: 'no-store', signal: controller.signal});
        if (!response.ok) throw new Error('Proof unavailable');
        const value = await response.json() as BudgetProof;
        if (!value || typeof value !== 'object' || !['ready', 'not_ready'].includes(value.status || '')) throw new Error('Invalid proof');
        if (active) {setData(value); setError(false); setReadAt(new Date());}
      } catch {
        if (active) setError(true);
      } finally {
        if (active) timer = setTimeout(load, 15000);
      }
    }
    load();
    return () => {active = false; clearTimeout(timer); controller?.abort();};
  }, []);

  const fuji = data?.chainId === 43113;
  const ready = data?.status === 'ready' && fuji && ADDRESS.test(data.contract || '');
  const actors = [data?.merchant, data?.relayer, data?.beneficiary];
  const distinct = actors.every(value => ADDRESS.test(value || '')) && new Set(actors.map(value => value?.toLowerCase())).size === 3;
  const tests = Array.isArray(data?.proof?.tests) ? data.proof.tests.filter(test => test && typeof test.name === 'string' && typeof test.passed === 'boolean') : [];
  const passed = tests.filter(test => test.passed).length;
  const operations: {key: 'fundTx' | 'holdTx' | 'settleTx' | 'releaseTx' | 'claimTx'; title: string; detail: string}[] = [
    {key: 'fundTx', title: 'Budget depositato', detail: 'Il contratto custodisce i token di prova del locale.'},
    {key: 'holdTx', title: 'Commissione riservata', detail: 'La scelta del cliente impegna il budget autorizzato.'},
    {key: 'settleTx', title: 'Credito maturato', detail: 'La conferma del ritiro accredita il beneficiario fissato nel mandato.'},
    {key: 'releaseTx', title: 'Budget sbloccato', detail: 'Una scadenza libera la somma riservata, senza maturare la commissione.'},
    {key: 'claimTx', title: 'Credito riscosso', detail: 'Il beneficiario ritira il credito maturato dal contratto.'},
  ];

  return <Frame><main className="mandate-lab">
    <style>{styles}</style>
    <div className="mandate-kicker"><ShieldCheck size={16} aria-hidden="true" /> MANDATO DI SPESA SU AVALANCHE FUJI</div>
    <section className="mandate-intro">
      <div><h1>L’AI propone.<br /><em>Il mandato decide.</em></h1><p>Il locale autorizza un budget per acquisire ordini. Il contratto custodisce i fondi e applica i limiti anche quando l’AI invia una proposta.</p></div>
      <div className="mandate-scope"><span>SOLO RETE DI PROVA</span><strong>Test AVAX</strong><p>Token senza valore reale.<br />Il pranzo si paga al locale.</p></div>
    </section>

    <section className="mandate-phases" aria-label="Come funziona il mandato">
      <article><span>01</span><h2>Il locale autorizza</h2><p>Deposita il budget e firma il mandato con il proprio wallet. Il beneficiario della commissione è già stabilito.</p></article>
      <article><span>02</span><h2>Il contratto limita</h2><p>La scelta del cliente riserva la commissione. Una richiesta oltre il budget disponibile deve essere respinta onchain.</p></article>
      <article><span>03</span><h2>Il ritiro decide</h2><p>La conferma del gestore fa maturare il credito. Alla scadenza, una chiamata al contratto sblocca la riserva.</p></article>
    </section>

    {error && <div role="alert" className="mandate-alert">La lettura delle prove non è disponibile ora.{data ? ' Mostriamo l’ultima risposta ricevuta, che potrebbe non essere aggiornata.' : ' Non mostriamo saldi o transazioni simulati.'}</div>}
    {data?.chainId !== undefined && !fuji && <div role="alert" className="mandate-alert">La risposta non indica Avalanche Fuji 43113. I saldi e i collegamenti alle prove restano sospesi.</div>}

    <section className="mandate-budget" aria-labelledby="mandate-budget-title">
      <div className="mandate-section-head"><div><span className="mandate-overline">BUDGET CUSTODITO DAL CONTRATTO</span><h2 id="mandate-budget-title">Ogni proposta ha un limite</h2></div><span className="mandate-proof-status" role="status">{error ? 'Lettura da aggiornare' : ready ? 'Prove disponibili' : data ? 'Prove in preparazione' : 'Lettura delle prove…'}</span></div>
      <dl className="mandate-amounts">
        {[
          ['Disponibile', data?.availableAvax],
          ['Riservato', data?.reservedAvax],
          ['Commissioni maturate', data?.spentAvax],
          ['Credito da riscuotere', data?.creditsAvax],
        ].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{fuji ? amount(value) : '—'}</dd><span>test AVAX</span></div>)}
      </dl>
      <div className="mandate-contract"><span>Contratto Fuji</span>{fuji ? <ChainLink value={data?.contract} kind="address" /> : <span>In attesa della prova</span>}</div>
      <p className="mandate-budget-note">Il budget finanzia la commissione del mandato. Il prezzo del pasto e il pagamento al locale restano separati.</p>
    </section>

    <section className="mandate-section" aria-labelledby="mandate-roles-title">
      <div className="mandate-section-head"><h2 id="mandate-roles-title">Chi può fare cosa</h2><span className="mandate-subtle">{distinct && fuji ? 'Tre indirizzi distinti' : ready ? 'Gestore distinto dal relayer' : 'Indirizzi da verificare'}</span></div>
      <div className="mandate-roles">
        <article><h3>Wallet del locale</h3><p>Autorizza il mandato con firma EIP-712. Decide limiti e beneficiario.</p>{fuji ? <ChainLink value={data?.merchant} kind="address" /> : <span className="mandate-missing">In attesa della prova</span>}</article>
        <article><h3>Relayer</h3><p>Invia la transazione e paga il gas. La sua firma non sostituisce l’autorizzazione del locale.</p>{fuji ? <ChainLink value={data?.relayer} kind="address" /> : <span className="mandate-missing">In attesa della prova</span>}</article>
        <article><h3>Beneficiario</h3><p>Riceve il credito previsto dal mandato e può riscuoterlo.</p>{fuji ? <ChainLink value={data?.beneficiary} kind="address" /> : <span className="mandate-missing">In attesa della prova</span>}</article>
      </div>
      <p className="mandate-fineprint">Nel laboratorio la piattaforma è sia relayer sia beneficiario. I locali dimostrativi hanno firme distinte, gestite dall’app; un gestore registrato firma nel proprio browser. Sono ruoli di prova, non attività commerciali aderenti.</p>
    </section>

    <section className="mandate-section" aria-labelledby="mandate-proof-title">
      <div className="mandate-section-head"><div><span className="mandate-overline">PROVE PUBBLICHE</span><h2 id="mandate-proof-title">Le operazioni sulla rete</h2></div><span className="mandate-subtle">Fuji C-Chain 43113</span></div>
      <ol className="mandate-transactions">{operations.map((operation, index) => <li key={operation.key}><span className="mandate-step">0{index + 1}</span><div><h3>{operation.title}</h3><p>{operation.detail}</p></div>{fuji ? <ChainLink value={data?.proof?.[operation.key]} kind="tx" label="Apri prova" /> : <span className="mandate-missing">In attesa della prova</span>}</li>)}</ol>
      <p className="mandate-fineprint">Ritiro confermato e scadenza sono percorsi alternativi. Le prove possono riferirsi a ordini di test diversi. Un link porta all’explorer: verifica sempre l’esito della transazione.</p>
    </section>

    <section className="mandate-section" aria-labelledby="mandate-tests-title">
      <div className="mandate-section-head"><h2 id="mandate-tests-title">I limiti messi alla prova</h2><span className="mandate-test-count">{fuji && tests.length ? `${passed} / ${tests.length} superati` : 'Risultati non ancora disponibili'}</span></div>
      {fuji && tests.length ? <ul className="mandate-tests">{tests.map((test, index) => <li key={`${index}-${test.name}`}><span className={test.passed ? 'mandate-test-icon passed' : 'mandate-test-icon failed'}>{test.passed ? <Check size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />}</span><div><strong>{test.name}</strong><span className="mandate-test-verdict">{test.passed ? 'Test superato' : 'Test non superato'}</span><Evidence value={test.evidence} /></div></li>)}</ul> : <p className="mandate-empty"><Clock3 size={20} aria-hidden="true" /> I risultati compariranno quando il laboratorio avrà completato le verifiche. Nessun esito viene generato in questa pagina.</p>}
      <p className="mandate-fineprint">La conferma del ritiro resta una dichiarazione del gestore. Il contratto applica le condizioni del mandato, senza verificare da solo la consegna fisica.</p>
    </section>

    <div className="mandate-bottom"><a className="mandate-chain-link" href="/">Torna all’arena<ArrowUpRight size={17} aria-hidden="true" /></a><span>{readAt ? `Ultima lettura ${readAt.toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Rome'})}. Aggiornamento ogni 15 secondi.` : 'Pagina pubblica in sola lettura.'}</span></div>
  </main></Frame>;
}

const styles = `
.mandate-lab{color:#17211f;padding-top:38px}.mandate-lab p{color:#59645f}.mandate-kicker{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:.13em}.mandate-intro{display:flex;justify-content:space-between;align-items:end;gap:45px;margin:23px 0 44px}.mandate-intro h1{font-size:clamp(2.8rem,5.3vw,4.65rem);line-height:1.02}.mandate-intro h1 em{color:#de4528;font-style:normal}.mandate-intro>div:first-child>p{max-width:665px;font-size:17px;line-height:1.7;margin-top:24px}.mandate-scope{flex:0 0 224px;border-left:2px solid #17211f;padding:8px 0 8px 25px}.mandate-scope>span{font-size:10px;font-weight:800;letter-spacing:.12em}.mandate-scope>strong{display:block;font-size:30px;letter-spacing:-.05em;margin:6px 0}.mandate-scope p{font-size:13px;line-height:1.65}.mandate-phases{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:34px;border-top:1px solid #cfd4c8;padding-top:25px;margin-bottom:46px}.mandate-phases article>span{font-size:13px;color:#de4528;font-weight:800}.mandate-phases h2{font-size:21px;margin:9px 0 13px}.mandate-phases p{font-size:14px;line-height:1.7}.mandate-alert{padding:18px 21px;background:#fff0da;border:1px solid #d4a767;font-size:14px;line-height:1.6;margin-bottom:24px}.mandate-budget{background:#17211f;color:#f6f4ed;padding:33px 35px 24px;border-radius:3px}.mandate-section-head{display:flex;justify-content:space-between;align-items:center;gap:24px}.mandate-section-head h2{font-size:27px;letter-spacing:-.04em}.mandate-overline{display:block;font-size:10px;letter-spacing:.15em;font-weight:800;margin-bottom:11px}.mandate-proof-status{font-size:12px;font-weight:700;color:#eaff78;text-align:right}.mandate-amounts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:25px;margin:36px 0 31px}.mandate-amounts>div{min-width:0}.mandate-amounts dt{font-size:12px;color:#ced5cb;min-height:36px}.mandate-amounts dd{margin:0;overflow-wrap:anywhere;font-size:clamp(1.9rem,3.3vw,3.1rem);letter-spacing:-.055em;line-height:1.12;font-weight:800}.mandate-amounts>div:first-child dd{color:#eaff78}.mandate-amounts>div>span{display:block;font-size:11px;color:#ced5cb;margin-top:8px}.mandate-contract{display:flex;gap:17px;align-items:center;flex-wrap:wrap;border-top:1px solid #45534a;padding-top:18px;font-size:13px}.mandate-lab .mandate-budget-note{color:#ced5cb;font-size:12px;line-height:1.6;margin-top:18px}.mandate-chain-link{display:inline-flex;gap:7px;align-items:center;font-weight:700;font-size:13px;text-decoration:underline;text-underline-offset:4px;overflow-wrap:anywhere}.mandate-chain-link svg{flex-shrink:0}.mandate-section{margin-top:50px}.mandate-subtle,.mandate-test-count{font-size:12px;color:#647166}.mandate-roles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:33px;margin-top:25px}.mandate-roles article{padding-top:17px;border-top:1px solid #cfd4c8}.mandate-roles h3{font-size:18px}.mandate-roles p{font-size:14px;line-height:1.7;margin:10px 0 16px;min-height:71px}.mandate-fineprint{font-size:12px;line-height:1.65;margin-top:21px;max-width:850px}.mandate-missing{font-size:12px;color:#738077}.mandate-budget .mandate-missing{color:#ced5cb}.mandate-transactions{list-style:none;margin:26px 0 0;padding:0}.mandate-transactions li{display:grid;grid-template-columns:42px 1fr 158px;gap:17px;align-items:center;padding:21px 0;border-top:1px solid #cfd4c8}.mandate-transactions h3{font-size:17px}.mandate-transactions p{font-size:13px;line-height:1.65;margin-top:4px}.mandate-step{font-size:12px;font-weight:800;color:#de4528}.mandate-tests{list-style:none;margin:24px 0 0;padding:0}.mandate-tests li{display:flex;align-items:flex-start;gap:13px;border-top:1px solid #cfd4c8;padding:18px 0}.mandate-tests strong{font-size:14px}.mandate-test-icon{display:inline-flex;padding-top:2px}.mandate-test-icon.passed{color:#367638}.mandate-test-icon.failed{color:#b4311c}.mandate-test-verdict{display:block;font-size:11px;color:#59645f;margin:3px 0 5px}.mandate-test-detail{display:block;font-size:12px;line-height:1.6;color:#59645f;overflow-wrap:anywhere;max-width:850px}.mandate-empty{display:flex;gap:12px;align-items:flex-start;padding:23px 0;font-size:14px;line-height:1.7}.mandate-empty svg{flex-shrink:0;margin-top:3px}.mandate-bottom{display:flex;justify-content:space-between;align-items:center;gap:25px;margin-top:42px;padding-top:21px;border-top:1px solid #cfd4c8}.mandate-bottom>span{font-size:11px;color:#647166}.mandate-lab a:focus-visible{outline:3px solid #de4528;outline-offset:5px}
@media(max-width:800px){.mandate-intro{align-items:start;gap:23px}.mandate-intro h1{font-size:3.4rem}.mandate-scope{flex-basis:180px;padding-left:18px}.mandate-phases,.mandate-roles{gap:20px}.mandate-budget{padding:27px 24px}.mandate-amounts{grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}.mandate-amounts dt{min-height:0;margin-bottom:10px}.mandate-amounts dd{font-size:2.5rem}.mandate-roles p{min-height:120px}}
@media(max-width:600px){.mandate-lab{padding-top:28px}.mandate-intro{display:block;margin-bottom:29px}.mandate-intro h1{font-size:clamp(2.7rem,10.4vw,3.6rem)}.mandate-intro>div:first-child>p{font-size:15px;line-height:1.65}.mandate-scope{margin-top:23px;padding:0 0 0 17px}.mandate-scope>strong{font-size:23px;margin:4px 0}.mandate-scope p{font-size:12px}.mandate-phases{grid-template-columns:1fr;gap:20px;margin-bottom:30px;padding-top:22px}.mandate-phases h2{font-size:20px;margin:5px 0 8px}.mandate-phases p{font-size:13px}.mandate-section-head{align-items:start;gap:12px}.mandate-section-head h2{font-size:23px}.mandate-proof-status{max-width:95px;font-size:11px}.mandate-budget{padding:24px 20px}.mandate-overline{font-size:9px;line-height:1.6}.mandate-amounts{margin-top:28px;gap:24px 16px}.mandate-amounts dd{font-size:2.2rem}.mandate-amounts dt{font-size:11px}.mandate-section{margin-top:35px}.mandate-roles{grid-template-columns:1fr;gap:19px}.mandate-roles p{min-height:0;margin:8px 0 11px}.mandate-transactions li{grid-template-columns:26px 1fr;gap:12px;padding:18px 0}.mandate-transactions li>.mandate-chain-link,.mandate-transactions li>.mandate-missing{grid-column:2}.mandate-section>.mandate-section-head{flex-wrap:wrap}.mandate-fineprint{font-size:11px}.mandate-bottom{align-items:start;flex-direction:column;gap:15px}.mandate-bottom>span{line-height:1.7}}
`;
