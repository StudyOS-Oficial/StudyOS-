const enc = new TextEncoder();
const html = (s,status=200,headers={}) => new Response(s,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const json = (o,status=200) => new Response(JSON.stringify(o),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const hex = b => [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const hash = async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
const rand = ()=>{const b=new Uint8Array(32);crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('')};
const safe = s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cookie = request => (request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('studyos_access='))?.slice(15);
async function auth(req,env){const t=cookie(req);if(!t)return null;return await env.ACCESS.get('session:'+await hash(t));}
async function stripeVerify(raw,signature,secret){if(!signature)return false;const t=signature.match(/(?:^|,)t=(\d+)/)?.[1];const sigs=[...signature.matchAll(/(?:^|,)v1=([a-f0-9]+)/g)].map(m=>m[1]);if(!t||!sigs.length||Math.abs(Date.now()/1000-Number(t))>300)return false;const k=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const expected=hex(await crypto.subtle.sign('HMAC',k,enc.encode(t+'.'+raw)));return sigs.some(x=>x.length===expected.length&&x===expected)}
async function sendAccessEmail(env,to,url){if(!env.RESEND_API_KEY||!env.MAIL_FROM)throw new Error('Email not configured');const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json'},body:JSON.stringify({from:env.MAIL_FROM,to:[to],subject:'Tu acceso a la biblioteca StudyOS',text:'Accede a tu biblioteca StudyOS mediante este enlace de un solo uso, válido durante 30 minutos: '+url,html:`<div style="font:16px Arial;max-width:560px"><h2>Bienvenida a StudyOS</h2><p>Accede a tu biblioteca privada mediante este enlace de un solo uso. Caduca en 30 minutos.</p><p><a href="${url}">Entrar en mi biblioteca</a></p></div>`})});if(!r.ok)throw new Error('Email provider: '+r.status)}
async function magic(env,address){const token=rand();await env.ACCESS.put('magic:'+await hash(token),address,{expirationTtl:1800});await sendAccessEmail(env,address,env.BASE_URL.replace(/\/$/,'')+'/claim?t='+encodeURIComponent(token))}
const shell=(title,body)=>`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${safe(title)} · StudyOS</title><style>body{margin:0;background:#f5f2e9;color:#263b30;font:16px system-ui}main{max-width:660px;margin:9vh auto;padding:28px}section{background:white;padding:30px;border-radius:22px;box-shadow:0 8px 35px #263b3010}h1{font-size:30px}a,button{background:#344f3b;color:white;padding:13px 18px;border:0;border-radius:12px;text-decoration:none;display:inline-block;cursor:pointer}input{padding:13px;border:1px solid #bbb;border-radius:10px;max-width:100%;box-sizing:border-box}li{margin:14px 0}small{color:#6a756c}</style><main><section><p><b>STUDYOS</b> · Biblioteca privada</p><h1>${safe(title)}</h1>${body}</section></main></html>`;
export default {async fetch(req,env){try{const u=new URL(req.url),path=u.pathname;
if(path==='/stripe-webhook'&&req.method==='POST'){
 const raw=await req.text();if(!await stripeVerify(raw,req.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET))return json({error:'invalid signature'},400);
 const ev=JSON.parse(raw);if(ev.type!=='checkout.session.completed'&&ev.type!=='checkout.session.async_payment_succeeded')return json({ok:true});
 const s=ev.data.object;if(s.payment_status!=='paid')return json({ok:true});
 const productByLink={
 'plink_1UOgH9PdiAyvfYF71bWghV11':['ebook1'],
 'plink_1UOgIdPdiAyvfYF76vWvCHci':['ebook2'],
 'plink_1UOgJbPdiAyvfYF7Z5A1PBpq':['ebook3'],
 'plink_1UOgLIPdiAyvfYF77WRmmODa':['ebook1','ebook2','ebook3','plus']
 };
 const entitlements=productByLink[s.payment_link]||(env.PAYMENT_LINK_PLUS_ID&&s.payment_link===env.PAYMENT_LINK_PLUS_ID?['plus']:null);
 if(!entitlements)return json({ok:true,ignored:'unrecognised_payment_link'});
 const emailAddr=(s.customer_details?.email||s.customer_email||'').trim().toLowerCase();if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(emailAddr))return json({error:'missing_or_invalid_buyer_email'},422);
 const key='event:'+ev.id;if(await env.ACCESS.get(key))return json({ok:true,duplicate:true});
 const buyerKey='buyer:'+await hash(emailAddr);let buyer={email:emailAddr,entitlements:[]};const previous=await env.ACCESS.get(buyerKey);if(previous){try{buyer=JSON.parse(previous)}catch{}}
 buyer.email=emailAddr;buyer.entitlements=[...new Set([...(buyer.entitlements||[]),...entitlements])];
 await env.ACCESS.put(buyerKey,JSON.stringify(buyer));
 await magic(env,emailAddr);await env.ACCESS.put(key,'1',{expirationTtl:7776000});return json({ok:true});
}
if(path==='/claim'){
 const t=u.searchParams.get('t')||'',h=await hash(t),addr=await env.ACCESS.get('magic:'+h);if(!addr)return html(shell('Enlace caducado','<p>Solicita un nuevo enlace de acceso.</p><a href="/access">Solicitar acceso</a>'),403);
 await env.ACCESS.delete('magic:'+h);const sess=rand();await env.ACCESS.put('session:'+await hash(sess),addr,{expirationTtl:60*60*24*14});return new Response(null,{status:302,headers:{location:'/library','set-cookie':`studyos_access=${sess}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1209600`,'cache-control':'no-store'}});
}
if(path==='/access'&&req.method==='GET')return html(shell('Accede a tu compra','<p>Introduce el correo usado en el pago.</p><form method="post"><input name="email" type="email" required placeholder="tu@email.com"><button>Enviar enlace</button></form>'));
if(path==='/access'&&req.method==='POST'){
 const form=await req.formData(),addr=String(form.get('email')||'').trim().toLowerCase();if(addr.includes('@')&&await env.ACCESS.get('buyer:'+await hash(addr)))await magic(env,addr);
 return html(shell('Comprueba tu correo','<p>Si este correo tiene una compra registrada, recibirás un enlace de acceso. Revisa también spam.</p>'));
}
if(path==='/library'){
 const addr=await auth(req,env);if(!addr)return Response.redirect(env.BASE_URL+'/access',302);
 let buyer={email:addr,entitlements:[]};try{buyer=JSON.parse(await env.ACCESS.get('buyer:'+await hash(addr))||'{}')}catch{}
 const docs=[['ebook1','ebook-1.pdf','Tu Nueva Versión'],['ebook2','ebook-2.pdf','Pre-Daily OS'],['ebook3','ebook-3.pdf','Ayuno OS']];const lis=docs.filter(([k])=>(buyer.entitlements||[]).includes(k)).map(([,f,n])=>`<li><a href="/download/${f}">${safe(n)} · PDF ↓</a></li>`).join('');
 const plus=(buyer.entitlements||[]).includes('plus')?`<h2>StudyOS+</h2><p>Tu compra incluye StudyOS+. La aplicación pública todavía no aplica permisos de acceso individuales.</p><p><a href="${safe(env.STUDYOS_URL||'#')}">Abrir StudyOS+ ↗</a></p>`:'';
 return html(shell('Tu biblioteca',`<p>Acceso de ${safe(addr)}</p><ul>${lis||'<li>Aún no hay eBooks asociados a esta cuenta.</li>'}</ul>${plus}`));
}
if(path.startsWith('/download/')){
 const addr=await auth(req,env);if(!addr)return html(shell('Acceso necesario','<a href="/access">Entrar</a>'),401);
 const key=path.slice('/download/'.length);const allowed={'ebook-1.pdf':'ebook1','ebook-2.pdf':'ebook2','ebook-3.pdf':'ebook3'};if(!allowed[key])return new Response('Not found',{status:404});
 let buyer={entitlements:[]};try{buyer=JSON.parse(await env.ACCESS.get('buyer:'+await hash(addr))||'{}')}catch{}if(!(buyer.entitlements||[]).includes(allowed[key]))return html(shell('Acceso no disponible','<p>Este documento no forma parte de las compras de tu cuenta.</p>'),403);
 const obj=await env.DOCUMENTS.get(key);if(!obj)return html(shell('Documento pendiente','<p>El archivo todavía no está disponible en el almacenamiento privado.</p>'),404);
 return new Response(obj.body,{headers:{'content-type':'application/pdf','content-disposition':`attachment; filename="${key}"`,'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
}
return Response.redirect(env.BASE_URL+'/access',302);
}catch(e){console.error(e);return html(shell('No se ha podido completar','<p>Inténtalo de nuevo o contacta con soporte.</p>'),500)}}};
