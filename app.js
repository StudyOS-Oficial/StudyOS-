const NEEDS={en:'Más energía',hi:'Bajar la hinchazón',an:'Calmar los antojos',sa:'Saciarte de verdad',ra:'Algo rápido',ai:'Priorizar lo antiinflamatorio'};
const MOMENTS={D:'Desayuno',C:'Comida',N:'Cena',S:'Snack'};
const PHASES={menstrual:'Menstrual',folicular:'Folicular',ovulatoria:'Ovulatoria',lutea:'Lútea',perimenopausia:'Perimenopausia',menopausia:'Menopausia'};
const FAVORITES_KEY='studyos_plus_favorites_v2';
let favorites=[];
try{favorites=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]')}catch(e){favorites=[]}
let currentResults=[];

const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const slug=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

function saveFav(){try{localStorage.setItem(FAVORITES_KEY,JSON.stringify(favorites))}catch(e){}}
function isFav(id){return favorites.includes(id)}
function toggleFav(id){
  favorites=isFav(id)?favorites.filter(x=>x!==id):[...favorites,id]; saveFav(); renderLibrary(); renderFavorites(); renderFavCount();
  toast(isFav(id)?'Guardada en tus favoritos':'Quitada de favoritos');
}
function renderFavCount(){ $('#favCount').textContent=favorites.length||''; }
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),1900)}

function photoFor(r){
  const t=r.title.toLowerCase();
  if(t.includes('salmón')) return 'assets/dentro-salmon-foto.jpg';
  if(t.includes('lentejas')) return 'assets/dentro-lentejas-foto.jpg';
  if(t.includes('bowl de quinoa')) return 'assets/dentro-bowl-foto.jpg';
  if(t.includes('wok de tofu')) return 'assets/dentro-wok-foto.jpg';
  return '';
}
function initials(title){return title.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function card(r){
  const photo=photoFor(r);
  return `<article class="recipe-card">
    <div class="card-top"><span class="pill">${esc(r.phase)}</span><button class="fav ${isFav(r.id)?'on':''}" onclick="toggleFav('${esc(r.id)}')" aria-label="${isFav(r.id)?'Quitar de favoritos':'Guardar en favoritos'}">${isFav(r.id)?'♥':'♡'}</button></div>
    <div class="thumb" style="margin-top:13px;height:110px">${photo?`<img src="${photo}" alt="${esc(r.title)}">`:`<span class="monogram">${esc(initials(r.title))}</span>`}</div>
    <h3>${esc(r.title)}</h3>
    <p>${r.time} min · ${r.difficulty} · ${r.calories} kcal</p>
    <div class="meta">${r.tags.slice(0,3).map(n=>`<span class="tag">${esc(NEEDS[n]||n)}</span>`).join('')}</div>
    <div class="card-bottom"><span class="tag">${esc(r.allergens)}</span><button class="open" onclick="openRecipe('${esc(r.id)}')">Ver receta →</button></div>
  </article>`;
}
function renderLibrary(list=STUDYOS_RECIPES){
  currentResults=list; $('#recipeCount').textContent=`${list.length} ${list.length===1?'receta':'recetas'}`;
  $('#libraryGrid').innerHTML=list.length?list.map(card).join(''):`<div class="empty">No hemos encontrado recetas con esos filtros. Prueba a cambiar una opción.</div>`;
}
function renderFavorites(){
  const list=STUDYOS_RECIPES.filter(r=>isFav(r.id));
  $('#favGrid').innerHTML=list.length?list.map(card).join(''):`<div class="empty">Todavía no has guardado ninguna receta. Pulsa ♡ en cualquier receta para tenerla aquí.</div>`;
}
function filterLibrary(){
  const q=$('#search').value.trim().toLowerCase(); const phase=$('#filterPhase').value; const need=$('#filterNeed').value; const moment=$('#filterMoment').value;
  const list=STUDYOS_RECIPES.filter(r=>{
    const hay=[r.title,r.ingredients.join(' '),r.metaIngredients.join(' ')].join(' ').toLowerCase();
    return (!q||hay.includes(q)) && (!phase||r.phaseTags.includes(phase)) && (!need||r.tags.includes(need)) && (!moment||r.moments.includes(moment));
  });
  renderLibrary(list);
}
function recommend(){
  const phase=$('#pickPhase').value, need=$('#pickNeed').value, moment=$('#pickMoment').value;
  let ranked=STUDYOS_RECIPES.map(r=>{
    let score=Math.random()*0.02;
    if(phase && r.phaseTags.includes(phase))score+=5;
    if(need && r.tags.includes(need))score+=4;
    if(moment && r.moments.includes(moment))score+=3;
    if(need==='ra' && r.time<=15)score+=2;
    return {r,score};
  }).sort((a,b)=>b.score-a.score);
  const best=ranked[0]?.r;
  if(!best)return;
  $('#result').classList.add('show');
  const photo=photoFor(best);
  $('#result').innerHTML=`<div class="thumb">${photo?`<img src="${photo}" alt="${esc(best.title)}">`:`<span class="monogram">${esc(initials(best.title))}</span>`}</div><div><span class="eyebrow">Tu recomendación</span><h3>${esc(best.title)}</h3><div class="meta"><span class="tag">${esc(best.phase)}</span><span class="tag">${best.time} min</span><span class="tag">${best.calories} kcal aprox.</span></div><p>${esc(best.why.slice(0,240))}${best.why.length>240?'…':''}</p></div><button class="primary" onclick="openRecipe('${esc(best.id)}')">Abrir receta</button>`;
}
function surprise(){
  const pool=STUDYOS_RECIPES.filter(r=>r.time<=25); const r=pool[Math.floor(Math.random()*pool.length)];
  $('#pickPhase').value='';$('#pickNeed').value='';$('#pickMoment').value='';
  $('#result').classList.add('show');
  const photo=photoFor(r);
  $('#result').innerHTML=`<div class="thumb">${photo?`<img src="${photo}" alt="${esc(r.title)}">`:`<span class="monogram">${esc(initials(r.title))}</span>`}</div><div><span class="eyebrow">Hoy te proponemos</span><h3>${esc(r.title)}</h3><div class="meta"><span class="tag">${esc(r.phase)}</span><span class="tag">${r.time} min</span><span class="tag">${esc(r.difficulty)}</span></div><p>${esc(r.ingredients.slice(0,3).join(' · '))}</p></div><button class="primary" onclick="openRecipe('${esc(r.id)}')">Ver receta</button>`;
}
function openRecipe(id){
  const r=STUDYOS_RECIPES.find(x=>x.id===id); if(!r)return;
  const photo=photoFor(r);
  $('#modal').classList.add('open'); document.body.style.overflow='hidden';
  $('#modalHead').innerHTML=`<span class="eyebrow">${esc(r.phase)}</span><h2>${esc(r.title)}</h2><div class="meta"><span class="tag">${r.time} minutos</span><span class="tag">${r.calories} kcal aprox.</span><span class="tag">${esc(r.difficulty)}</span><span class="tag">Alérgenos: ${esc(r.allergens)}</span></div><button class="close" onclick="closeModal()" aria-label="Cerrar">×</button>`;
  $('#modalBody').innerHTML=`${photo?`<img src="${photo}" alt="${esc(r.title)}" style="width:100%;height:230px;object-fit:cover;border-radius:20px;margin-bottom:24px">`:''}<div class="recipe-layout"><div class="block"><h4>Ingredientes</h4><ul>${r.ingredients.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="block"><h4>Preparación</h4><ol>${r.preparation.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div></div><div class="why"><h4>El Porqué Biológico</h4><p>${esc(r.why)}</p></div><div class="notice">Aviso: el recetario tiene carácter informativo y educativo. No es consejo médico ni nutricional personalizado y no sustituye la consulta con una profesional sanitaria. Revisa siempre los alérgenos y las etiquetas de los productos.</div>`;
}
function closeModal(){ $('#modal').classList.remove('open');document.body.style.overflow=''; }
function switchView(view){
  $$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${view}`));
  if(view==='library')renderLibrary(); if(view==='favorites')renderFavorites(); window.scrollTo({top:0,behavior:'smooth'});
}

$('#search').addEventListener('input',filterLibrary); $('#filterPhase').addEventListener('change',filterLibrary); $('#filterNeed').addEventListener('change',filterLibrary); $('#filterMoment').addEventListener('change',filterLibrary);
$('#recommend').addEventListener('click',recommend); $('#surprise').addEventListener('click',surprise);
$$('.nav button').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
const closeBtn=$('#closeModal'); if(closeBtn) closeBtn.addEventListener('click',closeModal);
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

function initStudyOS(){
  renderLibrary();
  renderFavorites();
  renderFavCount();
  $('#homeGrid').innerHTML=STUDYOS_RECIPES.slice(0,6).map(card).join('');
  requestAnimationFrame(()=>setTimeout(()=>$('#loader').classList.add('hide'),180));
}

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initStudyOS,{once:true});}else{initStudyOS();}
// Safety net: never leave the user behind a loader because of a slow/broken resource.
window.addEventListener('error',()=>$('#loader')?.classList.add('hide'),true);
setTimeout(()=>$('#loader')?.classList.add('hide'),6500);
