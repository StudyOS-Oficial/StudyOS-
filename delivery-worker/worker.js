const enc = new TextEncoder();
const PRODUCTS = {
  ebook1: { title: "Tu Nueva Versión", pdf: "ebooks/ebook-1.pdf", html: "ebooks/ebook-1.html" },
  ebook2: { title: "Pre-Daily OS", pdf: "ebooks/ebook-2.pdf", html: "ebooks/ebook-2.html" },
  ebook3: { title: "Ayuno OS", pdf: "ebooks/ebook-3.pdf", html: "ebooks/ebook-3.html" }
};
const PACK = ["ebook1", "ebook2", "ebook3"];
const COMMON = {
  "cache-control": "no-store, private",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
};
const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const json = (v, status=200) => new Response(JSON.stringify(v), {status,headers:{...COMMON,"content-type":"application/json; charset=utf-8"}});
function page(title, body, status=200) {
  const content = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+esc(title)+' · StudyOS</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f5ef;color:#263d2d;font:16px/1.65 system-ui}main{max-width:740px;margin:5vh auto;padding:18px}section{background:#fffefa;border:1px solid #dfe7dc;border-radius:22px;padding:clamp(20px,5vw,40px)}h1{font:normal clamp(30px,6vw,42px)/1.15 Georgia,serif}a,.button{display:inline-block;background:#31583e;color:#fff;text-decoration:none;border:0;border-radius:99px;padding:12px 18px;font:inherit;font-weight:700;cursor:pointer}input{display:block;width:100%;padding:13px;border:1px solid #bdcbbb;border-radius:12px;margin:12px 0 16px;font:inherit}.muted,small{color:#6d7c70}li{margin:12px 0}.row{display:flex;gap:10px;flex-wrap:wrap}</style></head><body><main><section><p><b>studyos.</b> · Biblioteca privada</p><h1>'+esc(title)+'</h1>'+body+'</section></main></body></html>';
  return new Response(content,{status,headers:{...COMMON,"content-type":"text/html; charset=utf-8"}});
}
const token = () => { const b=new Uint8Array(32);crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,"0")).join(""); };
const sha = async s => {const b=await crypto.subtle.digest("SHA-256",enc.encode(s));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("");};
const emailNorm = x => String(x||"").trim().toLowerCase();
const emailValid = x => x.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
function cookie(req){const c=(req.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("studyos_access="));return c?decodeURIComponent(c.slice(15)):"";}
async function session(req,env){const t=cookie(req);return t?env.ACCESS.get("session:"+await sha(t)):null;}
async function verifyStripe(raw,signature,secret){
 if(!signature||!secret)return false;
 const ts=signature.match(/(?:^|,)t=(\d+)/)?.[1], sigs=[...signature.matchAll(/(?:^|,)v1=([a-f0-9]+)/g)].map(m=>m[1]);
 if(!ts||!sigs.length||Math.abs(Date.now()/1000-Number(ts))>300)return false;
 const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const d=await crypto.subtle.sign("HMAC",key,enc.encode(ts+"."+raw));
 const expected=Array.from(new Uint8Array(d),x=>x.toString(16).padStart(2,"0")).join("");
 return sigs.some(x=>x.length===expected.length&&x===expected);
}
function mappedOffer(link,env){
 if(link&&link===env.STRIPE_LINK_EBOOK1)return "ebook1";
 if(link&&link===env.STRIPE_LINK_EBOOK2)return "ebook2";
 if(link&&link===env.STRIPE_LINK_EBOOK3)return "ebook3";
 if(link&&link===env.STRIPE_LINK_PACK)return "pack";
 return null;
}
async function sendMagic(env,address){
 if(!env.RESEND_API_KEY||!env.MAIL_FROM||!env.BASE_URL)throw new Error("Email delivery not configured");
 const t=token();await env.ACCESS.put("magic:"+await sha(t),address,{expirationTtl:1800});
 const u=new URL("/claim",env.BASE_URL);u.searchParams.set("t",t);
 const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{authorization:"Bearer "+env.RESEND_API_KEY,"content-type":"application/json"},body:JSON.stringify({from:env.MAIL_FROM,to:[address],subject:"El teu accés privat a StudyOS",html:'<div style="font:16px/1.6 Arial,sans-serif"><h2>Benvingut/da a StudyOS</h2><p>La compra s’ha confirmat. Entra a la teva biblioteca privada:</p><p><a href="'+u.href+'">Obrir la meva biblioteca</a></p><p>L’enllaç és d’un sol ús i caduca en 30 minuts.</p></div>'})});
 if(!r.ok)throw new Error("Email provider returned "+r.status);
}
async function buyerRecord(env,address){const b=await env.ACCESS.get("buyer:"+await sha(address),"json");return b&&Array.isArray(b.products)?b:{email:address,products:[]};}
async function grant(env,address,offer){
 const b=await buyerRecord(env,address), products=offer==="pack"?[...new Set([...b.products,...PACK])]:[...new Set([...b.products,offer])];
 await env.ACCESS.put("buyer:"+await sha(address),JSON.stringify({email:address,products,updatedAt:new Date().toISOString()}));
}
async function stripeWebhook(req,env){
 const raw=await req.text();if(!await verifyStripe(raw,req.headers.get("stripe-signature"),env.STRIPE_WEBHOOK_SECRET))return json({error:"Invalid Stripe signature"},400);
 let ev;try{ev=JSON.parse(raw)}catch{return json({error:"Invalid JSON"},400)}
 if(!["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(ev.type))return json({received:true});
 const s=ev.data&&ev.data.object;if(!s||s.payment_status!=="paid")return json({received:true,ignored:"Payment not paid"});
 const offer=mappedOffer(s.payment_link,env);if(!offer)return json({received:true,ignored:"Unmapped payment link"});
 const address=emailNorm((s.customer_details&&s.customer_details.email)||s.customer_email);if(!emailValid(address))return json({error:"Missing buyer email"},422);
 const key="stripe-event:"+ev.id;if(await env.ACCESS.get(key))return json({received:true,duplicate:true});
 await grant(env,address,offer);await sendMagic(env,address);
 await env.ACCESS.put(key,"1",{expirationTtl:7776000});return json({received:true});
}
async function access(req,env){
 if(req.method==="GET")return page("Recupera el teu accés",'<p>Introdueix el correu de la compra i t’enviarem un enllaç privat si hi ha una compra associada.</p><form method="post"><label for="email">Correu electrònic</label><input id="email" name="email" type="email" autocomplete="email" maxlength="254" required><button class="button">Enviar enllaç privat</button></form><small>L’enllaç caduca al cap de 30 minuts.</small>');
 const f=await req.formData(),address=emailNorm(f.get("email"));
 if(emailValid(address)&&await env.ACCESS.get("buyer:"+await sha(address))){try{await sendMagic(env,address)}catch(e){console.error("Magic email failed",e)}}
 return page("Revisa el teu correu","<p>Si hi ha una compra associada, rebràs un enllaç privat. Revisa també el correu brossa.</p>");
}
async function claim(req,env,url){
 const t=url.searchParams.get("t")||"";if(!/^[a-f0-9]{64}$/.test(t))return page("Enllaç caducat",'<p>Sol·licita un altre enllaç.</p><a href="/access">Sol·licitar accés</a>',403);
 const k="magic:"+await sha(t),address=await env.ACCESS.get(k);if(!address)return page("Enllaç caducat",'<p>Sol·licita un altre enllaç.</p><a href="/access">Sol·licitar accés</a>',403);
 await env.ACCESS.delete(k);const st=token();await env.ACCESS.put("session:"+await sha(st),address,{expirationTtl:1209600});
 return new Response(null,{status:302,headers:{...COMMON,location:"/library","set-cookie":"studyos_access="+encodeURIComponent(st)+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1209600"}});
}
async function library(req,env){
 const address=await session(req,env);if(!address)return Response.redirect(new URL("/access",req.url),302);
 const b=await buyerRecord(env,address),items=b.products.filter(x=>PRODUCTS[x]).map(x=>'<li><b>'+esc(PRODUCTS[x].title)+'</b><div class="row"><a href="/read/'+x+'">Llegir en línia</a><a href="/download/'+x+'">Descarregar PDF</a></div></li>').join("");
 return page("La teva biblioteca",'<p class="muted">Accés associat a '+esc(address)+'</p>'+(items?"<ul>"+items+"</ul>":"<p>No hi ha cap eBook associat a aquest correu.</p>")+'<p><a href="/logout">Tancar sessió</a></p>');
}
async function documentRoute(req,env,id,format){
 const address=await session(req,env);if(!address)return Response.redirect(new URL("/access",req.url),302);
 const b=await buyerRecord(env,address);if(!b.products.includes(id))return page("Accés no inclòs",'<p>Aquesta guia no forma part de les teves compres.</p><a href="/library">Tornar a la biblioteca</a>',403);
 const p=PRODUCTS[id],o=await env.DOCUMENTS.get(format==="pdf"?p.pdf:p.html);
 if(!o)return page("EBook pendent",'<p>El fitxer privat encara no s’ha pujat. No activis la venda fins que estigui disponible.</p><a href="/library">Tornar a la biblioteca</a>',503);
 if(format==="pdf")return new Response(o.body,{headers:{...COMMON,"content-type":"application/pdf","content-disposition":'attachment; filename="'+id+'.pdf"'}});
 return new Response(o.body,{headers:{...COMMON,"content-type":"text/html; charset=utf-8","content-security-policy":"default-src 'none'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}});
}
export default {async fetch(req,env){
 const u=new URL(req.url),p=u.pathname;
 try{
  if(p==="/health")return json({ok:true,service:"studyos-private-delivery",paymentsEnabled:env.PAYMENTS_ENABLED==="true"});
  if(p==="/stripe-webhook"&&req.method==="POST"){if(env.PAYMENTS_ENABLED!=="true")return json({received:true,paymentsEnabled:false});return stripeWebhook(req,env)}
  if(p==="/access"&&["GET","POST"].includes(req.method))return access(req,env);
  if(p==="/claim"&&req.method==="GET")return claim(req,env,u);
  if(p==="/library"&&req.method==="GET")return library(req,env);
  if(p==="/logout")return new Response(null,{status:302,headers:{...COMMON,location:"/access","set-cookie":"studyos_access=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"}});
  const m=p.match(/^\/(read|download)\/(ebook1|ebook2|ebook3)$/);if(m&&req.method==="GET")return documentRoute(req,env,m[2],m[1]==="download"?"pdf":"html");
  return page("No trobat",'<p>Aquesta pàgina no existeix.</p><a href="/access">Biblioteca privada</a>',404);
 }catch(e){console.error("StudyOS delivery error",e);return page("Error temporal","<p>Torna-ho a provar més tard.</p>",500)}
}};
