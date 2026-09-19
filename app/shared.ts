export const ZONES=['Università / Viale Pindaro','Porta Nuova','Pescara centro'];
export const money=(c:number)=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(c/100);
export const time=(n:number)=>new Date(n).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Rome'});
export async function api(action:string,data:Record<string,unknown>={}){const r=await fetch('/api/passo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...data})});const out:any=await r.json();if(!r.ok)throw new Error(out.error||'Operazione non riuscita');return out;}
export async function read(query:string){const r=await fetch('/api/passo?'+query,{cache:'no-store'});const out:any=await r.json();if(!r.ok)throw new Error(out.error||'Dati non disponibili');return out;}
