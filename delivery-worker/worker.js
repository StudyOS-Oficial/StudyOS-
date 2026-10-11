const enc=new TextEncoder();
const PRODUCTS={ebook1:{title:"Tu Nueva Versión",pdf:"ebooks/ebook-1.pdf",html:"ebooks/ebook-1.html"},ebook2:{title:"Pre-Daily OS",pdf:"ebooks/ebook-2.pdf",html:"ebooks/ebook-2.html"},ebook3:{title:"Ayuno OS",pdf:"ebooks/ebook-3.pdf",html:"ebooks/ebook-3.html"}};
const PACK=["ebook1","ebook2","ebook3"];
const LINKS={ebook1:"plink_1UOgH9PdiAyvfYF71bWghV11",ebook2:"plink_1UOgIdPdiAyvfYF76vWvCHci",ebook3:"plink_1UOgJbPdiAyvfYF7Z5A1PBpq",pack:"plink_1UOgLIPdiAyvfYF77WRmmODa"};
const H={"cache-control":"no-store, private","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
const html=(title,body,status=200)=>new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+title+' · StudyOS</title><style>body{font:16px system-ui;max-width:760px;margin:8vh auto;padding:20px;background:#f6f5ef;color:#263d2d}section{background:white;padding:28px;border-radius:20px}a{display:inline-block;background:#31583e;color:white;padding:12px 18px;border-radius:30px;text-decoration:none;margin:6px 4px 0 0}</style><section><p><b>studyos.</b> · Biblioteca privada</p><h1>'+title+'</h1>'+body+'</section>',{status,headers:{...H,"content-type":"text/html;charset=utf-8"}});
const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...H,"content-type":"application/json"}});
const token=()=>{const b=new Uint8Array(32);crypto.getRandomValues(b);return [...b].map(x=>x.toString(16).padStart(2,"0")).join("")};
const sha=async x=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(x)))].map(x=>x.toString(16).padStart(2,"0")).join("");
const cookie=r=>{const x=(r.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("studyos_access="));return x?decodeURIComponent(x.slice(15)):""};
async function session(r,e){
  const t=cookie(r);if(!t)return null;
  const s=await e.ACCESS.get("session:"+await sha(t),{type:"json"});if(!s)return null;
  if(!s.purchaseId||await e.ACCESS.get("revoked:"+s.purchaseId))return null;
  return s;
}
function offer(link,e){const m={};m[e.STRIPE_LINK_EBOOK1||LINKS.ebook1]="ebook1";m[e.STRIPE_LINK_EBOOK2||LINKS.ebook2]="ebook2";m[e.STRIPE_LINK_EBOOK3||LINKS.ebook3]="ebook3";m[e.STRIPE_LINK_PACK||LINKS.pack]="pack";return m[link]||null}
async function stripeGet(id,e){const u="https://api.stripe.com/v1/checkout/sessions/"+encodeURIComponent(id);const r=await fetch(u,{headers:{Authorization:"Bearer "+e.STRIPE_SECRET_KEY}});if(!r.ok)throw new Error("Stripe session lookup failed");return r.json()}
async function stripeListByPaymentIntent(pi,e){const u="https://api.stripe.com/v1/checkout/sessions?limit=1&payment_intent="+encodeURIComponent(pi);const r=await fetch(u,{headers:{Authorization:"Bearer "+e.STRIPE_SECRET_KEY}});if(!r.ok)throw new Error("Stripe session list failed");const j=await r.json();return j.data?.[0]||null}
async function stripeChargeGet(id,e){const u="https://api.stripe.com/v1/charges/"+encodeURIComponent(id);const r=await fetch(u,{headers:{Authorization:"Bearer "+e.STRIPE_SECRET_KEY}});if(!r.ok)throw new Error("Stripe charge lookup failed");return r.json()}
async function paidSession(id,e){
  if(!/^cs_[A-Za-z0-9_]+$/.test(id))return null;
  const s=await stripeGet(id,e);if(s.payment_status!=="paid")return null;
  const o=offer(s.payment_link,e);return o?{sessionId:s.id,offer:o,products:o==="pack"?PACK:[o],paymentIntent:typeof s.payment_intent==="string"?s.payment_intent:null}:null
}
async function grantPurchase(s,e){
  if(await e.ACCESS.get("revoked:"+s.sessionId))return null;
  const purchase={products:s.products,createdAt:new Date().toISOString(),paymentIntent:s.paymentIntent||null};
  await e.ACCESS.put("purchase:"+s.sessionId,JSON.stringify(purchase),{expirationTtl:31536000});
  if(s.paymentIntent)await e.ACCESS.put("pi:"+s.paymentIntent,s.sessionId,{expirationTtl:31536000});
  return s.products
}
async function makeAccess(products,purchaseId,e){const t=token();await e.ACCESS.put("session:"+await sha(t),JSON.stringify({products,purchaseId}),{expirationTtl:1209600});return t}
function buttons(products){return products.map(id=>'<p><b>'+PRODUCTS[id].title+'</b><br><a href="/download/'+id+'">Descarregar PDF</a><a href="/read/'+id+'">Llegir en línia</a></p>').join("")}
async function verifySignature(raw,sig,secret){if(!sig||!secret)return false;const t=sig.match(/(?:^|,)t=(\d+)/)?.[1],vs=[...sig.matchAll(/(?:^|,)v1=([a-f0-9]+)/g)].map(x=>x[1]);if(!t||!vs.length||Math.abs(Date.now()/1000-Number(t))>300)return false;const k=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const d=await crypto.subtle.sign("HMAC",k,enc.encode(t+"."+raw));const h=[...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("");return vs.some(x=>x.length===h.length&&x===h)}
async function thanks(r,e,u){
  if(e.PAYMENTS_ENABLED!=="true")return html("Pagaments desactivats","<p>Aquest flux encara està en proves.</p>",503);
  const id=u.searchParams.get("session_id")||"";
  try{
    const s=await paidSession(id,e);if(!s||await e.ACCESS.get("revoked:"+s.sessionId))return html("Compra no confirmada","<p>No podem confirmar el pagament. No s'ha concedit cap accés.</p>",400);
    const p=await grantPurchase(s,e);if(!p)return html("Accés revocat","<p>Aquesta compra ja no és elegible per accedir al contingut.</p>",403);
    const t=await makeAccess(p,s.sessionId,e);return new Response(null,{status:302,headers:{...H,Location:"/thank-you?ready=1","Set-Cookie":"studyos_access="+encodeURIComponent(t)+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1209600"}})
  }catch(x){console.error(x);return html("Error temporal","<p>La compra no s'ha pogut verificar ara mateix. Torna-ho a provar.</p>",500)}
}
async function thankYou(r,e){const s=await session(r,e);if(!s)return html("Accés no disponible","<p>Primer has de completar una compra confirmada.</p>",403);return html("Compra confirmada","<p>Perfecte. El teu eBook ja està disponible de manera privada.</p>"+buttons(s.products)+"<p><a href='/library'>Obrir la biblioteca</a></p>")}
async function library(r,e){const s=await session(r,e);if(!s)return html("Accés no disponible","<p>No hi ha una sessió privada activa.</p>",401);return html("La teva biblioteca",buttons(s.products)+"<p><a href='/logout'>Tancar sessió</a></p>")}
async function documentRoute(r,e,id,kind){const s=await session(r,e);if(!s)return new Response("No autoritzat",{status:401,headers:H});if(!s.products.includes(id))return html("Accés no inclòs","<p>Aquest eBook no forma part de la compra.</p>",403);const p=PRODUCTS[id],o=await e.DOCUMENTS.get(kind==="pdf"?p.pdf:p.html);if(!o)return html("Fitxer pendent","<p>El fitxer privat encara no està preparat. No activis la venda fins que estigui disponible.</p>",503);return new Response(o.body,{headers:{...H,"content-type":kind==="pdf"?"application/pdf":"text/html;charset=utf-8","content-disposition":kind==="pdf"?'attachment; filename="'+id+'.pdf"':"inline"}})}
async function revokeByPaymentIntent(pi,e,reason){
  if(!pi)return false;
  let sid=await e.ACCESS.get("pi:"+pi);
  if(!sid){const s=await stripeListByPaymentIntent(pi,e);sid=s?.id||null}
  if(!sid)return false;
  await e.ACCESS.put("revoked:"+sid,reason,{expirationTtl:31536000});
  await e.ACCESS.delete("purchase:"+sid);
  return true
}
async function revokeEventObject(o,e,reason){
  const pi=typeof o?.payment_intent==="string"?o.payment_intent:null;
  if(await revokeByPaymentIntent(pi,e,reason))return true;
  const chargeId=typeof o?.charge==="string"?o.charge:null;
  if(chargeId){const ch=await stripeChargeGet(chargeId,e);const cpi=typeof ch?.payment_intent==="string"?ch.payment_intent:null;if(cpi)return revokeByPaymentIntent(cpi,e,reason)}
  return false
}
async function webhook(r,e){
  const raw=await r.text();
  if(e.PAYMENTS_ENABLED!=="true")return json({received:true,paymentsEnabled:false});
  if(!await verifySignature(raw,r.headers.get("stripe-signature"),e.STRIPE_WEBHOOK_SECRET))return json({error:"invalid signature"},400);
  let ev;try{ev=JSON.parse(raw)}catch{return json({error:"invalid json"},400)}
  const supported=["checkout.session.completed","checkout.session.async_payment_succeeded","refund.created","refund.updated","charge.dispute.created"];
  if(!supported.includes(ev.type))return json({received:true});
  const id=ev.data?.object?.id;if(!id)return json({received:true});
  const key="event:"+ev.id;if(await e.ACCESS.get(key))return json({received:true,duplicate:true});
  try{
    if(ev.type==="checkout.session.completed"||ev.type==="checkout.session.async_payment_succeeded"){
      const s=await paidSession(id,e);if(!s)return json({received:true,ignored:true});
      const granted=await grantPurchase(s,e);if(!granted)return json({received:true,ignored:true,revoked:true});
      await e.ACCESS.put(key,"1",{expirationTtl:7776000});return json({received:true})
    }
    const o=ev.data.object;
    if((ev.type==="refund.created"||ev.type==="refund.updated")&&o.status!=="succeeded")return json({received:true,ignored:true});
    const ok=await revokeEventObject(o,e,ev.type);await e.ACCESS.put(key,ok?"revoked":"1",{expirationTtl:7776000});return json({received:true,revoked:ok})
  }catch(x){console.error(x);return json({error:"fulfillment failed"},500)}
}
export default {async fetch(r,e){const u=new URL(r.url),p=u.pathname;try{
if(p==="/health")return json({ok:true,paymentsEnabled:e.PAYMENTS_ENABLED==="true"});
if(p==="/thanks"&&r.method==="GET")return thanks(r,e,u);
if(p==="/thank-you"&&r.method==="GET")return thankYou(r,e);
if(p==="/library"&&r.method==="GET")return library(r,e);
if(p==="/stripe-webhook"&&r.method==="POST")return webhook(r,e);
if(p==="/logout")return new Response(null,{status:302,headers:{...H,Location:"/thank-you","Set-Cookie":"studyos_access=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"}});
const m=p.match(/^\/(download|read)\/(ebook1|ebook2|ebook3)$/);if(m&&r.method==="GET")return documentRoute(r,e,m[2],m[1]==="download"?"pdf":"html");
return html("No trobat","<p>Aquesta pàgina no existeix.</p>",404);
}catch(x){console.error(x);return html("Error temporal","<p>Hi ha hagut un error temporal.</p>",500)}}};