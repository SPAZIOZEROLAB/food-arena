'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Check,Clock3,MapPin,Copy,Phone,Sparkles,Utensils,Leaf,Flame,ShieldCheck,LoaderCircle} from 'lucide-react';
import {Frame} from '../../customer';
import {api,read,money,time} from '../../shared';

type BudgetSettlement={
 state:'held'|'settled'|'expired'|'pending'|'none';
 holdTx?:string;
 settleTx?:string;
 releaseTx?:string;
 merchant:string;
 beneficiary:string;
 amountAvax:string|number;
 availableAvax:string|number;
 reservedAvax:string|number;
 spentAvax:string|number;
 creditsAvax:string|number;
 contract:string;
 chainId:43113;
};
type PendingAction='reserve'|'settle'|null;
const explorer='https://subnets-test.avax.network/c-chain';
function avax(value:string|number|undefined){
 const number=Number(value);
 return value===undefined||value===''||!Number.isFinite(number)?'—':new Intl.NumberFormat('it-IT',{maximumFractionDigits:8}).format(number);
}
function BudgetControl({budget}:{budget:BudgetSettlement}){
 const stateLabels={held:'Commissione riservata',settled:'Commissione regolata',expired:'Riserva scaduta',pending:'Conferma in corso',none:'Riserva non attiva'};
 const transactions=[['Riserva',budget.holdTx],['Regolamento',budget.settleTx],['Sblocco',budget.releaseTx]].filter((item)=>item[1]);
 return <section className="fund-control" aria-label="Budget di prova del locale">
  <div className="fund-control-heading"><div><span className="eyebrow"><ShieldCheck size={15}/> IL BUDGET DEL LOCALE</span><h3>{stateLabels[budget.state]}</h3></div><span className="fund-test-label">FUJI · TEST</span></div>
  <p className="fund-amount"><strong>{avax(budget.amountAvax)}</strong> test AVAX <span>commissione di questa offerta</span></p>
  <dl className="fund-balances"><div><dt>Disponibile</dt><dd>{avax(budget.availableAvax)}</dd></div><div><dt>Riservato</dt><dd>{avax(budget.reservedAvax)}</dd></div><div><dt>Regolato</dt><dd>{avax(budget.spentAvax)}</dd></div></dl>
  <p className="caption">Saldi in test AVAX. Il prezzo del tuo pranzo non cambia. Sono fondi di prova del locale, senza valore in euro.</p>
  <div className="fund-links">{transactions.map(([label,hash])=><a key={label} href={`${explorer}/tx/${hash}`} target="_blank" rel="noreferrer">{label} su Fuji <ArrowUpRight size={13}/></a>)}<a href="/mandato">Come protegge il mandato <ArrowUpRight size={13}/></a></div>
 </section>;
}

export default function Ticket({id}:{id:string}){
 const [d,setD]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false),[now,setNow]=useState(Date.now()),[ai,setAi]=useState(''),[aiBusy,setAiBusy]=useState(false),[rank,setRank]=useState<string[]>([]),[pendingAction,setPendingAction]=useState<PendingAction>(null),[pendingTx,setPendingTx]=useState('');
 const worker=useRef<Worker|null>(null),refreshInFlight=useRef<Promise<void>|null>(null),mutationInFlight=useRef(false),pendingRef=useRef<PendingAction>(null),refreshError=useRef<string|null>(null),mounted=useRef(false),generation=useRef(0);

 const refresh=useCallback((duringMutation=false):Promise<void>=>{
  if(mutationInFlight.current&&!duringMutation)return Promise.resolve();
  if(refreshInFlight.current)return refreshInFlight.current;
  const currentGeneration=generation.current;
  const task=(async()=>{
   try{
    let next=await read('view=request&id='+encodeURIComponent(id));
    let syncFailed=false;
    const needsSync=next.mine&&(next.request?.status==='reserving'||next.request?.status==='settling'||next.budgetSettlement?.state==='pending'||(next.budgetSettlement?.state==='held'&&Date.now()>next.request.pickup_by+3000)||pendingRef.current!==null);
    if(needsSync&&!mutationInFlight.current){
     if(mounted.current&&generation.current===currentGeneration)setD(next);
     try{
      await api('syncBudget',{requestId:id});
      next=await read('view=request&id='+encodeURIComponent(id));
     }catch(e:any){
      // Keep the known pending state visible when Fuji is temporarily unavailable.
      syncFailed=true;
      if(mounted.current&&generation.current===currentGeneration){refreshError.current=e.message||'La conferma è ancora in corso. Riprovo tra pochi secondi.';setError(refreshError.current!)}
     }
    }
    if(!mounted.current||generation.current!==currentGeneration)return;
    if(!syncFailed&&refreshError.current){const oldError=refreshError.current;refreshError.current=null;setError(current=>current===oldError?'':current)}
    const state=next.budgetSettlement?.state;
    const terminal=state==='settled'||state==='expired'||next.request?.status==='collected'||next.request?.status==='cancelled';
    const reservationComplete=pendingRef.current==='reserve'&&(state==='held'||(next.request?.status==='open'&&state!=='pending'));
    if(terminal||reservationComplete){pendingRef.current=null;setPendingAction(null);setPendingTx('')}
    setD(next);
   }catch(e:any){if(mounted.current&&generation.current===currentGeneration){refreshError.current=e.message||'Non riesco ad aggiornare la richiesta. Riprovo tra pochi secondi.';setError(refreshError.current!)}}
  })();
  refreshInFlight.current=task;
  void task.finally(()=>{if(refreshInFlight.current===task)refreshInFlight.current=null});
  return task;
 },[id]);

 useEffect(()=>{
  mounted.current=true;
  generation.current+=1;
  pendingRef.current=null;
  setPendingAction(null);
  setPendingTx('');
  setD(null);
  void refreshInFlight.current?.then(()=>refresh());
  void refresh();
  const timer=setInterval(()=>void refresh(),5000),clock=setInterval(()=>setNow(Date.now()),1000);
  return()=>{mounted.current=false;generation.current+=1;clearInterval(timer);clearInterval(clock);worker.current?.terminate();worker.current=null};
 },[refresh]);

 async function act(action:string,offerId?:string,code?:string){
  if(mutationInFlight.current)return;
  mutationInFlight.current=true;
  setBusy(true);
  setError('');
  try{
   // Finish an existing reconciliation before starting another state transition.
   await refreshInFlight.current;
   const result=await api(action,{requestId:id,offerId,code});
   if(result.pending){
    const nextPending:PendingAction=action==='demoCollect'?'settle':action==='accept'?'reserve':null;
    pendingRef.current=nextPending;
    setPendingAction(nextPending);
    setPendingTx(typeof result.txHash==='string'?result.txHash:'');
   }
   await refresh(true);
  }catch(e:any){setError(e.message||'Operazione non riuscita. Riprova.')}
  finally{mutationInFlight.current=false;setBusy(false)}
 }
 async function share(){try{await navigator.clipboard.writeText(location.href);setCopied(true)}catch{setError('Copia il link dalla barra del browser.')}}
 function compare(){
  setAiBusy(true);setAi('Carico il modello AI nel browser. Il primo avvio può richiedere circa un minuto.');
  if(!worker.current){
   worker.current=new Worker('/lunch-ranker.worker.js',{type:'module'});
   worker.current.onmessage=({data:m})=>{if(m.type==='result'){setRank(m.order);setAi('AI pronta: proposte ordinate per affinità con la richiesta. La scelta resta tua.');setAiBusy(false)}else if(m.type==='error'){setAi('AI non disponibile: puoi confrontare e scegliere le offerte direttamente.');setAiBusy(false)}};
   worker.current.onerror=()=>{setAi('Modello non caricato. Le offerte restano utilizzabili.');setAiBusy(false)};
  }
  worker.current.postMessage({id:crypto.randomUUID(),query:r.wish||'Un pranzo completo e gustoso con acqua',items:offers.map((o:any)=>({id:o.id,name:o.title,description:o.description}))});
 }

 const r=d?.request,chosen=d?.offers?.find((o:any)=>o.id===r?.chosen),budget:BudgetSettlement|null=d?.budgetSettlement??null;
 const settling=r?.status==='settling'||pendingAction==='settle'||(budget?.state==='pending'&&r?.status==='accepted');
 const reserving=r?.status==='reserving'||pendingAction==='reserve'||(budget?.state==='pending'&&!settling);
 const pending=reserving||settling;
 const expired=r&&r.pickup_by<=now&&r.status!=='collected';
 const held=budget?.state==='held'&&budget.chainId===43113;
 const settled=budget?.state==='settled'&&budget.chainId===43113;
 const canShowCode=r?.status==='accepted'&&held&&!pending&&!expired&&d.mine&&chosen?.code;
 const legacy=!!chosen&&!budget;
 const offers=(d?.offers?.filter((o:any)=>o.status==='offered'&&o.expires>now)||[]).sort((a:any,b:any)=>rank.length?(rank.indexOf(a.id)<0?999:rank.indexOf(a.id))-(rank.indexOf(b.id)<0?999:rank.indexOf(b.id)):a.price-b.price);

 const pendingPanel=<div className="fund-pending" role="status" aria-live="polite"><span className="fund-pending-icon"><LoaderCircle size={27}/></span><span className="eyebrow">{settling?'REGOLAMENTO IN CORSO':'LA TUA SCELTA È IN CONFERMA'}</span><h2>{settling?'Regolo la commissione del locale su Fuji…':'Confermo la riserva del budget del locale su Fuji…'}</h2><p>{settling?'Il ritiro si chiude quando la rete conferma il regolamento. Non devi pagare criptovaluta.':'Il codice di ritiro apparirà dopo la conferma. Il prezzo del pranzo resta quello scelto.'}</p><p className="caption">Puoi lasciare aperta questa pagina: si aggiorna ogni 5 secondi.</p>{pendingTx&&<a className="text-link" href={`${explorer}/tx/${pendingTx}`} target="_blank" rel="noreferrer">Segui la transazione <ArrowUpRight size={14}/></a>}</div>;

 return <Frame><main className="arena-page">
  <a className="text-link" href="/"><ArrowLeft size={15}/> Torna all’arena</a>
  {error&&<div className="error" role="alert">{error}</div>}
  {!d?<p className="loading">Carico la richiesta…</p>:<>
   {r.demo===1&&<div className="demo-banner"><span className="demo-dot"/> ARENA DEMO <span>Locali e pasti fittizi. Transazioni vere su Fuji, con fondi di prova.</span></div>}
   <div className="arena-heading"><div><span className="eyebrow">IL TUO BUDGET. LE LORO PROPOSTE.</span><h1>{reserving?'È quasi tuo.':chosen?'Hai scelto.':offers.length?'Il pranzo si fa avanti.':'La tua arena è aperta.'}</h1><div className="request-meta"><span><MapPin size={15}/> {r.zone}</span><span><Clock3 size={15}/> Entro {time(r.pickup_by)}</span><span>{r.quantity} {r.quantity===1?'persona':'persone'}{r.vegetarian===1?' · vegetariano':''}</span></div>{r.wish&&<p className="help">«{r.wish}»</p>}</div><div className="budget-stamp"><span>BUDGET TOTALE</span><strong>{money(r.budget)}</strong><small>Confezione inclusa</small></div></div>
   <div className="journey"><span className="done"><Check size={14}/> Budget lanciato</span><span className={chosen&&!reserving?'done':'current'}>02 · {reserving?'Conferma in corso':'Scegli il pranzo'}</span><span className={r.status==='collected'?'done':r.status==='accepted'||settling?'current':''}>03 · {r.demo?'Prova il ritiro':'Ritira al banco'}</span></div>
   {!d.mine&&<div className="notice"><p>Richiesta condivisa: solo chi l’ha creata può scegliere. <a className="link" href="/gestore">Sei un gestore? Rispondi dal tuo pannello.</a></p></div>}

   {chosen?<>
    <section className="selected-offer">
     <div className="selected-main"><span className="eyebrow">{pending?<Clock3 size={16}/>:<Check size={16}/>} {reserving?'SCELTA IN CONFERMA':r.demo?'LA TUA SCELTA DEMO':'LA TUA SCELTA'}</span><h2>{chosen.title}</h2><p>{chosen.description}</p><div className="flex top-margin"><strong>{chosen.venue_name}</strong><span className="amount">{money(chosen.price)}</span></div><p className="caption">{chosen.quantity} {chosen.quantity===1?'porzione':'porzioni'} · prezzo totale, confezione compresa.{!r.demo&&' Pagamento al locale.'}</p><div className="notice"><MapPin size={20}/><p>{chosen.address}<br/>Pronto dalle {time(chosen.ready_at)}. Termine: {time(r.pickup_by)}.</p></div><div className="actions">{chosen.phone&&<a className="secondary" href={'tel:'+chosen.phone}><Phone size={16}/> Chiama il locale</a>}{!r.demo&&<a className="secondary" target="_blank" rel="noreferrer" href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(chosen.address+' Pescara')}>Apri indirizzo <ArrowUpRight size={16}/></a>}</div></div>
     <div className="pickup-panel">
      {pending?pendingPanel:<>
       {canShowCode&&<><span className="eyebrow">{r.demo?'IL TUO CODICE DEMO':'MOSTRA QUESTO CODICE AL BANCO'}</span><div className="ticket">{chosen.code}</div><p>Una scelta. Un codice. Un solo ritiro.</p>{r.demo===1&&chosen.scripted===1?<><button className="primary wide top-margin" disabled={busy} onClick={()=>act('demoCollect',chosen.id,chosen.code)}>{busy?'Regolamento in corso…':'Simula ritiro e regola commissione'}<Check size={18}/></button><p className="caption top-margin">Nella prova fai anche la parte del gestore. Nessun ordine o pagamento reale.</p></>:<p className="caption top-margin">Tieni aperta questa pagina. Il gestore confermerà il codice alla consegna.</p>}</>}
       {r.status==='collected'&&<><span className="completion-mark"><Check size={36}/></span><h2>{r.demo?'Prova completata.':'Buon pranzo!'}</h2><p className="top-margin">{settled?'Il ritiro è registrato e la commissione del locale è regolata su Fuji.':r.demo?'Il ritiro della precedente demo è registrato.':'Il gestore ha registrato il ritiro.'}</p>{settled&&<div className="fund-earned"><span className="eyebrow">COMMISSIONE ACCREDITATA</span><strong>{avax(budget?.amountAvax)} <small>test AVAX</small></strong><p>Al beneficiario del mandato, dal fondo del locale. Nessun addebito crypto al cliente.</p>{budget&&<span className="caption">Credito complessivo del beneficiario: {avax(budget.creditsAvax)} test AVAX.</span>}</div>}</>}
       {legacy&&<div className="fund-legacy"><h3>Questa è una prova precedente.</h3><p>Non include il fondo ordini. Lancia una nuova richiesta per provare riserva e regolamento su Fuji.</p></div>}
       {!legacy&&r.status==='accepted'&&!held&&!expired&&budget?.state!=='expired'&&<div className="fund-legacy"><h3>La riserva non è confermata.</h3><p>Il codice di ritiro resta nascosto finché il budget del locale non risulta riservato su Fuji.</p></div>}
       {!d.mine&&r.status==='accepted'&&held&&!expired&&<p>Il codice di ritiro è visibile sul dispositivo che ha creato la richiesta.</p>}
       {(expired||budget?.state==='expired')&&r.status!=='collected'&&<p className="error">{budget?.state==='expired'?'La riserva del budget è scaduta. Questa offerta non è più confermabile.':'Il termine di ritiro è passato.'}{!r.demo&&' Contatta il locale.'}</p>}
      </>}
      <a className="text-link top-margin" href="/">Lancia un altro budget <ArrowUpRight size={15}/></a>
     </div>
    </section>
    {budget&&<BudgetControl budget={budget}/>}
   </>:pending?<><section className="fund-pending-card">{pendingPanel}</section>{budget&&<BudgetControl budget={budget}/>}</>:r.status==='open'&&!expired?<>
    <div className="offers-heading"><h2>{offers.length?`${offers.length} ${offers.length===1?'proposta per te':'proposte per te'}`:'In attesa di proposte'}</h2>{offers.length>1&&<button className="secondary ai-compare" disabled={aiBusy||busy||pending} onClick={compare}><Sparkles size={16}/>{aiBusy?'L’AI sta confrontando…':'Confronta con l’AI'}</button>}</div>
    {ai&&<p className="model-progress" role="status">{ai}</p>}
    {!offers.length?<div className="empty"><h3>{r.demo?'Nessuna proposta demo compatibile.':'La richiesta è pubblicata.'}</h3><p>{r.demo?'Prova con 10 € per una persona e 30 minuti. Nella demo ci sono tre menù: anche qui budget, porzioni e tempi devono tornare.':'I gestori della zona possono rispondere dal loro pannello. Riceverai proposte solo quando un locale aderente risponde.'}</p>{!r.demo&&<button className="secondary top-margin" onClick={share}><Copy size={16}/>{copied?'Link copiato':'Copia link della richiesta'}</button>}</div>:<div className="offer-grid">{offers.map((o:any,i:number)=><article className={'offer arena-offer tone-'+i%3} key={o.id}><div className="offer-top"><span className="venue-symbol">{o.title.includes('Focaccia')?<Flame size={28}/>:o.title.includes('Cous')?<Leaf size={28}/>:<Utensils size={28}/>}</span><span className="offer-number">0{i+1}</span></div><div className="offer-body"><div className="flex"><span className="eyebrow">{o.venue_name}</span>{rank[0]===o.id&&<span className="badge"><Sparkles size={12}/> Affinità AI</span>}</div><h2>{o.title}</h2><p>{o.description}</p><div className="offer-price"><strong>{money(o.price)}</strong><span>totale · {o.quantity} {o.quantity===1?'persona':'persone'}<br/>confezione inclusa</span></div><div className="offer-ready"><Clock3 size={17}/><span>Pronto dalle <strong>{time(o.ready_at)}</strong></span></div><small>{o.scripted?'Locale fittizio · nessun ritiro reale':o.address}</small><button className="primary wide" disabled={busy||pending||!d.mine} onClick={()=>act('accept',o.id)}>Scelgo questo <ArrowUpRight size={18}/></button><div className="expiry"><span/> Riservata per {Math.floor(Math.max(0,o.expires-now)/60000)}:{String(Math.floor(Math.max(0,o.expires-now)/1000)%60).padStart(2,'0')}</div></div></article>)}</div>}
    {d.mine&&<button className="text-button top-margin" disabled={busy||pending} onClick={()=>act('cancel')}>Chiudi questa richiesta</button>}
   </>:<div className="empty"><h3>{expired?'Il tempo della richiesta è terminato.':'Richiesta annullata.'}</h3><a className="primary top-margin" href="/">Lancia un nuovo budget <ArrowUpRight size={18}/></a></div>}
  </>}
 </main></Frame>;
}
