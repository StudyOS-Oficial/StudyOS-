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
async function email(env,to,url){if(!env.RESEND_API_KEY||!env.MAIL_FROM)throw new Error('Email not configured');const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json'},body:JSON.stringify({from:env.MAIL_FROM,to:[to],subject:'Tu acceso a StudyOS · Pack Menopausia',html:`<div style="font:16px Arial;max-width:560px"><h2>Bienvenida a StudyOS</h2><p>Tu compra se ha confirmado. Accede a tu biblioteca privada:</p><p><a href="${url}">Entrar en mi biblioteca</a></p><p>Este enlace caduca en 30 minutos. Puedes solicitar otro desde la página de acceso.</p></div>`})});if(!r.ok)throw new Error('Email provider: '+r.status)}
async function magic(env,email){const token=rand();await env.ACCESS.put('magic:'+await hash(token),email,{expirationTtl:1800});await emailSend();async function emailSend(){await email(env,email,env.BASE_URL+'/claim?t='+token)}}
const shell=(title,body)=>`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${safe(title)} · StudyOS</title><style>body{margin:0;background:#f5f2e9;color:#263b30;font:16px system-ui}main{max-width:660px;margin:9vh auto;padding:28px}section{background:white;padding:30px;border-radius:22px;box-shadow:0 8px 35px #263b3010}h1{font-size:30px}a,button{background:#344f3b;color:white;padding:13px 18px;border:0;border-radius:12px;text-decoration:none;display:inline-block;cursor:pointer}input{padding:13px;border:1px solid #bbb;border-radius:10px;max-width:100%;box-sizing:border-box}li{margin:14px 0}small{color:#6a756c}</style><main><section><p><b>STUDYOS</b> · Biblioteca privada</p><h1>${safe(title)}</h1>${body}</section></main></html>`;
export default {async fetch(req,env){try{const u=new URL(req.url),path=u.pathname;
if(path==='/stripe-webhook'&&req.method==='POST'){
 const raw=await req.text();if(!await stripeVerify(raw,req.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET))return json({error:'invalid signature'},400);
 const ev=JSON.parse(raw);if(ev.type!=='checkout.session.completed'&&ev.type!=='checkout.session.async_payment_succeeded')return json({ok:true});
 const s=ev.data.object;if(s.payment_status!=='paid')return json({ok:true});
 // Configure a Stripe Payment Link with client_reference_id=STUDYOS_MENO or set metadata.offer in Checkout Session.
 if(s.client_reference_id!==env.OFFER_ID&&s.metadata?.offer!==env.OFFER_ID)return json({ok:true,ignored:'different offer'});
 const emailAddr=(s.customer_details?.email||s.customer_email||'').trim().toLowerCase();if(!emailAddr)return json({error:'missing buyer email'},422);
 const key='event:'+ev.id;if(await env.ACCESS.get(key))return json({ok:true,duplicate:true});
 await env.ACCESS.put('buyer:'+await hash(emailAddr),emailAddr);
 await magic(env,emailAddr);await env.ACCESS.put(key,'1');return json({ok:true});
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
 const docs=[['ebook-1.pdf','Tu nueva versión'],['ebook-2.pdf','Pre-Daily OS'],['ebook-3.pdf','Ayuno OS']];const lis=docs.map(([f,n])=>`<li><a href="/download/${f}">${safe(n)} · PDF ↓</a></li>`).join('');
 return html(shell('Tu biblioteca',`<p>Acceso de ${safe(addr)}</p><ul>${lis}</ul><h2>StudyOS+</h2><p><a href="${safe(env.STUDYOS_URL||'#')}">Abrir StudyOS+ ↗</a></p><small>Atención: el acceso a StudyOS+ no queda restringido por esta biblioteca si su web sigue siendo pública.</small>`));
}
if(path.startsWith('/download/')){
 const addr=await auth(req,env);if(!addr)return html(shell('Acceso necesario','<a href="/access">Entrar</a>'),401);
 const key=path.slice('/download/'.length);if(!['ebook-1.pdf','ebook-2.pdf','ebook-3.pdf'].includes(key))return new Response('Not found',{status:404});const obj=await env.DOCUMENTS.get(key);if(!obj)return html(shell('Documento pendiente','<p>El archivo todavía no está disponible. Contacta con soporte.</p>'),404);
 return new Response(obj.body,{headers:{'content-type':'application/pdf','content-disposition':`attachment; filename="${key}"`,'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
}
return Response.redirect(env.BASE_URL+'/access',302);
}catch(e){console.error(e);return html(shell('No se ha podido completar','<p>Inténtalo de nuevo o contacta con soporte.</p>'),500)}}};
