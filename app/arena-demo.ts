import {db} from '../db/raw';
import {demoWallet,makeHold,budgetDomain} from './budget-server';
import {HOLD_TYPES} from './budget-abi';
export const arenaMenus=[
 {id:'verde',venue:'Verde · demo',name:'Cous cous, verdure e acqua',description:'Cous cous con ceci, zucchine, carote, limone e olio. Acqua 500 ml e confezione incluse. Offerta dimostrativa.',price:850,prep:8,vegetarian:1},
 {id:'bowl',venue:'Bowl · demo',name:'Bowl di pollo e acqua',description:'Riso, pollo, pomodorini, mais, carote e salsa yogurt. Acqua 500 ml e confezione incluse. Offerta dimostrativa.',price:990,prep:12,vegetarian:0},
 {id:'forno',venue:'Forno · demo',name:'Focaccia caprese e acqua',description:'Focaccia con mozzarella, pomodoro e basilico. Acqua 500 ml e confezione incluse. Offerta dimostrativa.',price:790,prep:6,vegetarian:1},
];
export async function seedArena(r:{id:string,zone:string,quantity:number,budget:number,vegetarian:boolean,pickupBy:number}){
 const n=Date.now(),statements:D1PreparedStatement[]=[],budgetOffers:any[]=[];
 for(const m of arenaMenus){
  if(m.price*r.quantity>r.budget||r.vegetarian&&!m.vegetarian||n+(m.prep+3)*60000>r.pickupBy)continue;
  const zoneKey=encodeURIComponent(r.zone),venueId='arena-demo-'+m.id+'-'+zoneKey,menuId=crypto.randomUUID(),offerId=crypto.randomUUID();
  const code=Array.from(crypto.getRandomValues(new Uint8Array(6))).map(x=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x%32]).join('');
  statements.push(db().prepare('INSERT OR IGNORE INTO venues(id,owner,name,address,zone,phone,demo,created) VALUES(?,?,?,?,?,?,?,?)').bind(venueId,'arena-demo:'+m.id+':'+zoneKey,m.venue,'Punto fittizio · '+r.zone+' · nessun ritiro reale',r.zone,'',1,n));
  statements.push(db().prepare('INSERT INTO menu(id,venue_id,name,description,price,stock,prep,vegetarian,active,updated) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(menuId,venueId,m.name,m.description,m.price,r.quantity,m.prep,m.vegetarian,0,n));
  statements.push(db().prepare("INSERT INTO offers(id,request_id,venue_id,menu_id,title,description,price,quantity,ready_at,expires,created,status,code) VALUES(?,?,?,?,?,?,?,?,?,?,?,'offered',?)").bind(offerId,r.id,venueId,menuId,m.name,m.description,m.price*r.quantity,r.quantity,n+(m.prep+3)*60000,Math.min(n+180000,r.pickupBy-60000),n,code));
  budgetOffers.push({id:offerId,venue_id:venueId,menu_id:menuId,title:m.name,description:m.description,price:m.price*r.quantity,quantity:r.quantity});
 }
 for(const offer of budgetOffers){const wallet=demoWallet(offer.venue_id),h=makeHold({id:r.id,pickup_by:r.pickupBy},offer,wallet.address),signature=await wallet.signTypedData(budgetDomain(),HOLD_TYPES,h);statements.push(db().prepare('INSERT INTO budget_offers(offer_id,order_id,merchant,amount,expires_at,terms_hash,signature,status) VALUES(?,?,?,?,?,?,?,?)').bind(offer.id,h.orderId,h.merchant,h.amount,h.expiresAt,h.termsHash,signature,'offered'));}
 if(statements.length)await db().batch(statements);
}
