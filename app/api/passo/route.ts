import {getChatGPTUser} from '../../chatgpt-auth';
import {db} from '../../../db/raw';
import {env} from 'cloudflare:workers';
import {seedArena} from '../../arena-demo';
import {ZONES} from '../../shared';
import {budgetContract,budgetDomain,makeHold,validSignature,storeOfferBudget,walletSnapshot,settlementView,syncBudgetRequest,startSettlement,settlementPayload,demoWallet,setupMerchantBudget,sendBudgetTx} from '../../budget-server';
import {HOLD_TYPES,SETTLEMENT_TYPES} from '../../budget-abi';
export const dynamic='force-dynamic';
const enc=new TextEncoder();
async function hash(t:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(t)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
function fail(s:string,status=400):never{throw Object.assign(new Error(s),{status})}
const s=(v:any,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const num=(v:any,min:number,max:number)=>{const n=Number(v);if(!Number.isInteger(n)||n<min||n>max)fail('Controlla i numeri inseriti.');return n};
const cookie=(r:Request)=>r.headers.get('cookie')?.match(/(?:^|;\s*)passo_ticket=([a-f0-9]{64})/)?.[1];
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');
const respond=(body:any,status=200,c?:string)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...(c?{'Set-Cookie':c}:{})}});
async function ownedVenue(){const u=await getChatGPTUser();if(!u)fail('Accedi come gestore per continuare.',401);const v=await db().prepare('SELECT * FROM venues WHERE owner = ?').bind(u.userId).first<any>();return {u,v}}
const publicRequest='id,budget,quantity,zone,wish,vegetarian,pickup_by,created,status,chosen,demo';
const DBNOW="CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)";
const holdSql=`SELECT COALESCE(SUM(o.quantity),0) FROM offers o JOIN requests r ON r.id=o.request_id WHERE o.menu_id=m.id AND ((o.status='offered' AND o.expires>MAX(?,${DBNOW}) AND r.status='open' AND r.pickup_by>MAX(?,${DBNOW})) OR (r.chosen=o.id AND ((o.status='accepted' AND r.status='accepted' AND r.pickup_by>MAX(?,${DBNOW})) OR (o.status IN ('reserving','settling') AND r.status IN ('reserving','settling')))))`;
async function menuFor(v:string,n:number){return (await db().prepare(`SELECT m.*,m.stock-(${holdSql}) AS available FROM menu m WHERE venue_id=? AND active=1 ORDER BY updated DESC`).bind(n,n,n,v).all<any>()).results}
export async function GET(req:Request){try{
 const p=new URL(req.url).searchParams,n=Date.now(),view=p.get('view');
 if(view==='merchant'){const {u,v}=await ownedVenue();const w=v?await db().prepare('SELECT * FROM budget_wallets WHERE venue_id=?').bind(v.id).first<any>():null;let budget=null;try{budget=w?await walletSnapshot(w.address):null}catch{budget=w?{merchant:w.address,configured:false,unavailable:true}:null}return respond({user:u.displayName,venue:v,budget,menu:v?await menuFor(v.id,n):[],requests:v?(await db().prepare(`SELECT ${publicRequest} FROM requests WHERE zone=? AND demo=? AND status='open' AND pickup_by>? ORDER BY created DESC LIMIT 80`).bind(v.zone,v.demo,n).all()).results:[],offers:v?(await db().prepare(`SELECT o.*,r.wish,r.budget,r.pickup_by,r.status AS request_status,b.status AS budget_status,b.hold_tx,b.settle_tx,b.release_tx,b.merchant AS merchant_wallet FROM offers o JOIN requests r ON r.id=o.request_id LEFT JOIN budget_offers b ON b.offer_id=o.id WHERE o.venue_id=? AND o.created>? ORDER BY o.created DESC LIMIT 100`).bind(v.id,n-86400000).all<any>()).results.map(({code,...safe})=>safe):[]})}
 if(view==='request'){
  const id=p.get('id'),r=await db().prepare('SELECT * FROM requests WHERE id=?').bind(id).first<any>();if(!r)fail('Richiesta non trovata.',404);
  const t=cookie(req),mine=!!t&&await hash(t)===r.owner_hash;delete r.owner_hash;
  const offers=(await db().prepare(`SELECT o.*,v.name AS venue_name,v.address,v.phone,v.demo,(v.owner LIKE 'arena-demo:%') AS scripted FROM offers o JOIN venues v ON v.id=o.venue_id WHERE request_id=? ORDER BY price,ready_at`).bind(id).all<any>()).results;
  for(const o of offers)if(!mine||r.chosen!==o.id||!['accepted','collected'].includes(r.status))delete o.code;
  return respond({request:r,mine,offers,now:n,budgetSettlement:r.chosen?await settlementView(r.chosen):null});
 }
 if(view==='mine'){const t=cookie(req);return respond({requests:t?(await db().prepare(`SELECT ${publicRequest} FROM requests WHERE owner_hash=? ORDER BY created DESC LIMIT 15`).bind(await hash(t)).all()).results:[]})}
 if(view==='status'){return respond({liveVenues:(await db().prepare('SELECT COUNT(*) AS n FROM venues WHERE demo=0').first<any>())?.n||0})}
 fail('Pagina non trovata.',404);
 }catch(e:any){return respond({error:e.status?e.message:'Dati non disponibili. Riprova tra poco.'},e.status||503)}}
export async function POST(req:Request){try{
 const url=new URL(req.url),origin=req.headers.get('origin');if(origin&&origin!==url.origin)fail('Origine della richiesta non valida.',403);
 if(Number(req.headers.get('content-length')||0)>12000)fail('Richiesta troppo lunga.',413);
 const raw=await req.text();if(raw.length>12000)fail('Richiesta troppo lunga.',413);let b:any;try{b=JSON.parse(raw)}catch{fail('Formato non valido.')}
 const n=Date.now();
 if(b.action==='budgetSetup'){const {v}=await ownedVenue();if(!v)fail('Crea prima il locale.');return respond(await setupMerchantBudget(v.id,s(b.address,42),s(b.signature,132),num(b.deadline,Math.floor(n/1000)+1,Math.floor(n/1000)+7200),s(b.ownershipSignature,132)))}
 if(b.action==='prepareBudgetOffer'){
  const {v}=await ownedVenue();if(!v)fail('Crea prima il locale.');const w=await db().prepare('SELECT address FROM budget_wallets WHERE venue_id=?').bind(v.id).first<any>();if(!w)fail('Attiva prima il mandato di prova del locale.');
  const r=await db().prepare('SELECT * FROM requests WHERE id=?').bind(s(b.requestId)).first<any>(),m=await db().prepare('SELECT * FROM menu WHERE id=? AND venue_id=? AND active=1').bind(s(b.menuId),v.id).first<any>();
  if(!r||!m||r.status!=='open'||r.zone!==v.zone||r.demo!==v.demo||r.pickup_by<=n||m.price*r.quantity>r.budget||r.vegetarian&&!m.vegetarian)fail('Richiesta o piatto non compatibile.');
  const account=await walletSnapshot(w.address);if(!account.configured||Number(account.availableAvax)<Number(account.commissionAvax))fail('Il fondo di prova del locale non copre una nuova acquisizione.');
  return respond({domain:budgetDomain(),hold:makeHold(r,{menu_id:m.id,venue_id:v.id,title:m.name,description:m.description,price:m.price*r.quantity,quantity:r.quantity},w.address)});
 }
 if(b.action==='prepareSettlement'){const {v}=await ownedVenue();if(!v)fail('Locale assente.');const o=await db().prepare("SELECT * FROM offers WHERE id=? AND venue_id=? AND status='accepted'").bind(s(b.offerId),v.id).first<any>();if(!o||o.code!==s(b.code).toUpperCase())fail('Ritiro o codice non valido.');return respond({domain:budgetDomain(),settlement:await settlementPayload(o.id)})}
 if(b.action==='syncBudget'||b.action==='expireBudget'){
  const r=await db().prepare('SELECT * FROM requests WHERE id=?').bind(s(b.requestId)).first<any>();if(!r)fail('Richiesta assente.',404);const t=cookie(req);let allowed=!!t&&await hash(t)===r.owner_hash;
  if(!allowed){const {v}=await ownedVenue();allowed=!!v&&!!await db().prepare('SELECT id FROM offers WHERE id=? AND venue_id=?').bind(r.chosen,v.id).first()};if(!allowed)fail('Non puoi gestire questa richiesta.',403);
  if(b.action==='expireBudget'){const o=await db().prepare('SELECT * FROM budget_offers WHERE offer_id=?').bind(r.chosen).first<any>();if(!o||o.expires_at>=Math.floor(n/1000))fail('La riserva non è ancora scaduta.');const state=await budgetContract().orders(o.order_id);if(Number(state.state)===1){const sent=await sendBudgetTx('release:'+o.offer_id,'releaseExpired',[o.order_id]);await db().prepare("UPDATE budget_offers SET status='releasing',release_tx=COALESCE(?,release_tx) WHERE offer_id=?").bind(sent.txHash||null,o.offer_id).run();if(sent.pending)return respond(sent)}}
  return respond(await syncBudgetRequest(r.id));
 }
 if(b.action==='request'){
  const budget=num(b.budget,100,10000),quantity=num(b.quantity,1,8),minutes=num(b.minutes,15,120),zone=s(b.zone),demo=b.demo===true?1:0;
  if(!ZONES.includes(zone))fail('Scegli una zona disponibile.');
  const t=cookie(req)||token(),owner=await hash(t);
  const active=await db().prepare("SELECT COUNT(*) AS n FROM requests WHERE owner_hash=? AND status IN ('open','accepted','reserving','settling') AND pickup_by>?").bind(owner,n).first<any>();if(active.n>=3)fail('Hai già tre richieste aperte. Chiudi una richiesta prima di crearne un’altra.',429);
  const ip=req.headers.get('cf-connecting-ip')||'local',lim=await hash(ip+':'+Math.floor(n/3600000));
  const rate=await db().prepare('INSERT INTO limits (id,count,expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(lim,n+3600000).first<any>();if(rate.count>(demo?120:25))fail('Troppe richieste. Riprova più tardi.',429);
  const id=crypto.randomUUID();const created=await db().prepare(`INSERT INTO requests(id,owner_hash,budget,quantity,zone,wish,vegetarian,pickup_by,created,status,demo) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM requests WHERE owner_hash=? AND status IN ('open','accepted','reserving','settling') AND pickup_by>${DBNOW})<3`).bind(id,owner,budget,quantity,zone,s(b.wish,400),b.vegetarian?1:0,n+minutes*60000,n,'open',demo,owner).run();if(!created.meta.changes)fail('Hai già tre richieste aperte.',429);
  if(demo&&b.arena===true)await seedArena({id,zone,quantity,budget,vegetarian:!!b.vegetarian,pickupBy:n+minutes*60000});
  return respond({id},201,`passo_ticket=${t}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${url.protocol==='https:'?'; Secure':''}`);
 }
 if(b.action==='venue'){
  const {u,v}=await ownedVenue();if(v)fail('Hai già un locale attivo.');const name=s(b.name,80),address=s(b.address,180),phone=s(b.phone,30),zone=s(b.zone);if(name.length<2||address.length<5||!ZONES.includes(zone)||(!b.demo&&!/^\+?[0-9 ()-]{6,25}$/.test(phone)))fail('Inserisci nome, indirizzo, zona e telefono validi.');if(!b.authorized)fail('Conferma che puoi gestire questo punto di ritiro.');
  await db().prepare('INSERT INTO venues(id,owner,name,address,zone,phone,demo,created) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,name,address,zone,phone,b.demo===false?0:1,n).run();return respond({ok:true});
 }
 if(b.action==='menu'){
  const {v}=await ownedVenue();if(!v)fail('Crea prima il locale.');const name=s(b.name,100),description=s(b.description,350);if(name.length<2)fail('Inserisci il nome del piatto.');const price=num(b.price,100,10000),stock=num(b.stock,1,100),prep=num(b.prep,1,90);
  await db().prepare('INSERT INTO menu(id,venue_id,name,description,price,stock,prep,vegetarian,updated) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),v.id,name,description,price,stock,prep,b.vegetarian?1:0,n).run();return respond({ok:true});
 }
 if(b.action==='pauseMenu'){const{v}=await ownedVenue();if(!v)fail('Locale assente.');await db().prepare('UPDATE menu SET active=0 WHERE id=? AND venue_id=?').bind(s(b.id),v.id).run();return respond({ok:true})}
 if(b.action==='offer'){
  const {v}=await ownedVenue();if(!v)fail('Crea prima il locale.');
  const r=await db().prepare('SELECT * FROM requests WHERE id=?').bind(s(b.requestId)).first<any>();if(!r||r.status!=='open'||r.pickup_by<=n)fail('La richiesta è scaduta o è già stata chiusa.');if(r.zone!==v.zone||r.demo!==v.demo)fail('Questa richiesta non appartiene alla zona o modalità del locale.');
  const m=await db().prepare('SELECT * FROM menu WHERE id=? AND venue_id=? AND active=1').bind(s(b.menuId),v.id).first<any>();if(!m)fail('Piatto non disponibile.');
  if(m.updated<n-86400000)fail('Disponibilità di ieri: pubblica un piatto con quantità aggiornate.');
  const total=m.price*r.quantity;if(total>r.budget)fail('Il prezzo totale supera il budget del cliente.');if(r.vegetarian&&!m.vegetarian)fail('Il cliente ha richiesto un piatto vegetariano.');
  const ready=n+(m.prep+3)*60000;if(ready>r.pickup_by)fail('Il piatto non sarebbe pronto entro il ritiro richiesto.');const expires=Math.min(n+180000,r.pickup_by-60000);if(expires<=n)fail('Non resta tempo sufficiente per accettare.');
  const id=crypto.randomUUID(),code=Array.from(crypto.getRandomValues(new Uint8Array(6))).map(x=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x%32]).join('');
  const wallet=await db().prepare('SELECT address FROM budget_wallets WHERE venue_id=?').bind(v.id).first<any>();if(!wallet)fail('Attiva prima il mandato di prova.');const budgetOffer={id,menu_id:m.id,venue_id:v.id,title:m.name,description:m.description,price:total,quantity:r.quantity};if(!validSignature(HOLD_TYPES,makeHold(r,budgetOffer,wallet.address),b.budgetSignature,wallet.address))fail('Firma del gestore non valida per questa offerta.',403);
  const h=makeHold(r,budgetOffer,wallet.address);
  const inserted=await db().batch([db().prepare(`INSERT OR IGNORE INTO offers(id,request_id,venue_id,menu_id,title,description,price,quantity,ready_at,expires,created,status,code) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? FROM menu m WHERE m.id=? AND m.active=1 AND m.stock-(${holdSql})>=? AND EXISTS(SELECT 1 FROM requests WHERE id=? AND status='open' AND pickup_by>MAX(?,${DBNOW})) AND ?>${DBNOW}`).bind(id,r.id,v.id,m.id,m.name,m.description,total,r.quantity,ready,expires,n,'offered',code,m.id,n,n,n,r.quantity,r.id,n,expires),db().prepare('INSERT INTO budget_offers(offer_id,order_id,merchant,amount,expires_at,terms_hash,signature,status) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM offers WHERE id=?)').bind(id,h.orderId,h.merchant,h.amount,h.expiresAt,h.termsHash,s(b.budgetSignature,132),'offered',id)]);if(!inserted[0].meta.changes)fail('Hai già risposto oppure la quantità è appena stata riservata.');return respond({id});
 }
 if(b.action==='accept'||b.action==='cancel'){
  const t=cookie(req);if(!t)fail('Apri la richiesta dal dispositivo che l’ha creata.',403);
  const r=await db().prepare('SELECT * FROM requests WHERE id=? AND owner_hash=?').bind(s(b.requestId),await hash(t)).first<any>();if(!r)fail('Puoi modificare soltanto la tua richiesta.',403);if(r.status!=='open')fail('La richiesta è già stata chiusa.');
  if(b.action==='cancel'){const cancelled=await db().batch([db().prepare("UPDATE requests SET status='cancelled' WHERE id=? AND status='open'").bind(r.id),db().prepare("UPDATE offers SET status='cancelled' WHERE request_id=? AND status='offered' AND EXISTS(SELECT 1 FROM requests WHERE id=? AND status='cancelled')").bind(r.id,r.id)]);if(!cancelled[0].meta.changes)fail('La richiesta è già stata accettata o chiusa.',409);return respond({ok:true})}
  if(r.pickup_by<=n)fail('Il termine di ritiro è passato.');
  const o=await db().prepare('SELECT * FROM offers WHERE id=? AND request_id=?').bind(s(b.offerId),r.id).first<any>();if(!o||o.status!=='offered'||o.expires<=n)fail('L’offerta non è più disponibile.');
  const mandate=await db().prepare('SELECT * FROM budget_offers WHERE offer_id=?').bind(o.id).first<any>();if(!mandate)fail('Questa è una prova precedente: lancia una nuova richiesta con il mandato Fuji.');
  const reserved=await db().batch([db().prepare(`UPDATE requests SET status='reserving',chosen=? WHERE id=? AND status='open' AND pickup_by>${DBNOW} AND EXISTS(SELECT 1 FROM offers WHERE id=? AND status='offered' AND expires>${DBNOW})`).bind(o.id,r.id,o.id),db().prepare("UPDATE offers SET status='reserving' WHERE id=? AND EXISTS(SELECT 1 FROM requests WHERE id=? AND chosen=? AND status='reserving')").bind(o.id,r.id,o.id),db().prepare("UPDATE budget_offers SET status='holding' WHERE offer_id=? AND EXISTS(SELECT 1 FROM requests WHERE id=? AND chosen=? AND status='reserving')").bind(o.id,r.id,o.id)]);if(!reserved[0].meta.changes)fail('Un’altra scelta è già in corso.',409);return respond(await syncBudgetRequest(r.id));
 }
 if(b.action==='withdraw'){
  const {v}=await ownedVenue();if(!v)fail('Locale assente.');const withdrawn=await db().prepare("UPDATE offers SET status='cancelled' WHERE id=? AND venue_id=? AND status='offered'").bind(s(b.offerId),v.id).run();if(!withdrawn.meta.changes)fail('Offerta già scelta, ritirata o chiusa.',409);return respond({ok:true});
 }
 if(b.action==='collect'||b.action==='demoCollect'){
  let v:any;if(b.action==='demoCollect'){const t=cookie(req);if(!t)fail('Usa il dispositivo che ha creato la prova.',403);v=await db().prepare("SELECT v.* FROM venues v JOIN offers o ON o.venue_id=v.id JOIN requests r ON r.id=o.request_id WHERE o.id=? AND r.owner_hash=? AND r.demo=1 AND v.owner LIKE 'arena-demo:%'").bind(s(b.offerId),await hash(t)).first<any>();if(!v)fail('Puoi simulare solo il tuo ritiro dimostrativo.',403)}else{v=(await ownedVenue()).v}if(!v)fail('Locale assente.');const o=await db().prepare("SELECT o.*,r.pickup_by FROM offers o JOIN requests r ON r.id=o.request_id WHERE o.id=? AND o.venue_id=? AND o.status='accepted' AND r.status='accepted' AND r.chosen=o.id").bind(s(b.offerId),v.id).first<any>();if(!o)fail('Ritiro non disponibile o già registrato.');if(o.pickup_by<n)fail('Orario di ritiro scaduto: verifica direttamente col cliente.');if(o.code!==s(b.code).toUpperCase())fail('Codice di ritiro non corretto.');
  const payload=await settlementPayload(o.id),signature=b.action==='demoCollect'?await demoWallet(o.venue_id).signTypedData(budgetDomain(),SETTLEMENT_TYPES,payload):s(b.budgetSignature,132);return respond(await startSettlement({id:o.request_id},o,signature));
 }
 if(b.action==='attest'||b.action==='demoAttest')fail('Questa attestazione è stata sostituita dal mandato vincolante. Crea una nuova richiesta.',410);
 fail('Operazione non riconosciuta.');
 }catch(e:any){console.error('Food Arena operation failed',e.status||503,e.status?e.message:'Storage or runtime error');return respond({error:e.status?e.message:'Operazione non riuscita. I dati inseriti restano qui: riprova.'},e.status||503)}}
