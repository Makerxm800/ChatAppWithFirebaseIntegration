/* ============================================================
   Nova Explorer — fast, modern file explorer (vanilla JS, no deps)
   Virtual library (persisted) + real PC folder via File System Access API
   ============================================================ */
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const uid = () => 'f' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
const DB_KEY = 'nova-explorer-v4';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------------- File kinds & icons ---------------- */
const EXT_KIND = {};
['jpg','jpeg','png','gif','webp','svg','bmp','avif','ico'].forEach(e=>EXT_KIND[e]='image');
['mp4','mov','webm','mkv','avi'].forEach(e=>EXT_KIND[e]='video');
['mp3','wav','ogg','flac','m4a'].forEach(e=>EXT_KIND[e]='audio');
['pdf','doc','docx','txt','md','rtf','odt','xls','xlsx','csv','ppt','pptx'].forEach(e=>EXT_KIND[e]='document');
['zip','rar','7z','tar','gz'].forEach(e=>EXT_KIND[e]='archive');
['js','ts','html','css','json','py','java','c','cpp','sh','xml','yml','yaml'].forEach(e=>EXT_KIND[e]='code');
['exe','apk','dmg','app','msi'].forEach(e=>EXT_KIND[e]='app');
const KIND_META = {
  folder:{icon:'🗂️',label:'Folder'}, image:{icon:'🖼️',label:'Image'}, video:{icon:'🎬',label:'Video'},
  audio:{icon:'🎵',label:'Audio'}, document:{icon:'📄',label:'Document'}, archive:{icon:'🗜️',label:'Archive'},
  code:{icon:'💻',label:'Code'}, app:{icon:'📦',label:'App'}, file:{icon:'📄',label:'File'}
};
const extOf = name => (name.split('.').pop() || '').toLowerCase() === name.toLowerCase() ? '' : name.split('.').pop().toLowerCase();
const kindOf = (name, isFolder) => isFolder ? 'folder' : (EXT_KIND[extOf(name)] || 'file');
const fmtSize = b => { if (b == null) return '—'; if (b === 0) return '0 B'; const u=['B','KB','MB','GB','TB']; const i=Math.min(u.length-1, Math.floor(Math.log(b)/Math.log(1024))); return (b/Math.pow(1024,i)).toFixed(i?1:0)+' '+u[i]; };
const fmtDate = t => t ? new Date(t).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}) : '—';

/* Generated artwork for seeded images/videos (offline, instant) */
function artURI(seed, label, isVideo){
  const hues = [[109,124,255],[177,107,255],[61,220,151],[255,180,84],[255,93,108],[64,190,255],[255,120,200]];
  const [h] = [hues[Math.abs(seed)%hues.length]]; const h2=(h+55)%360;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='440'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${h},80%,62%)'/><stop offset='1' stop-color='hsl(${h2},80%,42%)'/></linearGradient></defs><rect width='640' height='440' fill='url(#g)'/><circle cx='${120+(Math.abs(seed)*37)%400}' cy='95' r='42' fill='rgba(255,255,255,.75)'/><path d='M0 340 L170 190 L300 310 L420 180 L640 350 L640 440 L0 440 Z' fill='rgba(0,0,0,.28)'/><path d='M0 380 L220 250 L390 370 L520 270 L640 370 L640 440 L0 440 Z' fill='rgba(0,0,0,.32)'/>${isVideo?`<circle cx='320' cy='210' r='44' fill='rgba(0,0,0,.55)'/><path d='M305 185 L350 210 L305 235 Z' fill='#fff'/>`:''}<text x='22' y='420' font-family='sans-serif' font-size='17' fill='rgba(255,255,255,.85)'>${label.replace(/[<>&]/g,'')}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* ---------------- Seed virtual file system ---------------- */
let nodes = {};       // id -> node
let blobURLs = {};    // id -> object URL for uploaded / real-preview files (session only)
function node(o){ const n = Object.assign({id:uid(), starred:false, tags:[], created:Date.now()}, o); nodes[n.id]=n; return n; }
function seed(){
  nodes = {};
  const now = Date.now(), d = 864e5;
  const mk = (name,parent,extra={}) => node(Object.assign({name,parent,modified:now-Math.random()*20*d,size:0},extra));
  const folder = (name,parent,icon,extra={}) => mk(name,parent,Object.assign({isFolder:true,icon},extra));
  const file = (name,parent,size,content) => { const k=kindOf(name,false); const f=mk(name,parent,{isFolder:false,size,kind:k}); if(content!=null) f.content=content; if(k==='image') f.thumb=artURI(name.length*7+name.charCodeAt(0), name); if(k==='video') f.thumb=artURI(name.length*3+5, name, true); return f; };

  folder('Home', null, '🏠', {id:'home'});
  folder('Desktop','home','🖥️', {id:'desktop'});
  folder('Downloads','home','⬇️', {id:'downloads'});
  folder('Documents','home','📁', {id:'documents'});
  folder('Pictures','home','🌄', {id:'pictures'});
  folder('Music','home','🎧', {id:'music'});
  folder('Videos','home','🎞️', {id:'videos'});
  node({id:'trash', name:'Trash', parent:null, isFolder:true, icon:'🗑️'});
  node({id:'recent', name:'Recent', parent:null, isFolder:true, icon:'🕘', virtual:true});
  node({id:'starred', name:'Starred', parent:null, isFolder:true, icon:'⭐', virtual:true});

  // Desktop
  file('Welcome.txt','desktop',420,'Welcome to Nova Explorer! ⚡\n\n• Press SPACE on any file for Quick View (just like the screenshot)\n• Ctrl+K opens the command palette\n• Right-click anywhere for actions\n• Use "Open folder from PC" to browse a REAL folder from your computer (Chrome/Edge)\n• Drag & drop real files into any folder to add them\n\nKeyboard: Ctrl+A select all · F2 rename · Del delete · Ctrl+C/X/V copy/cut/paste');
  folder('Project Nova','desktop','🚀');
  file('screenshot-2026.png','desktop',1840000);

  // Downloads — echoes the screenshot folder
  ['4906754605744589866.jpg','4900211291788610581.jpg','4900211291788610582.jpg','4900211291788610583.jpg','4900211291788610584.jpg','4900211291788610660.jpg','4900211291788610661.jpg','4900211291788610665.jpg','4904502805930904589.jpg','4904502805930904592.jpg'].forEach((n,i)=>{ const f=file(n,'downloads',240000+i*37000); f.modified = now - i*36e5*5; });
  file('3595377649273886931.mp4','downloads',335800000);
  file('08814c7b-668e-40da-8eef-aff7b572a9.txt','downloads',1204,'Download complete ✓\nChecksum verified.\nSource: nova-explorer demo library');
  file('9091K94f890167893456.txt','downloads',860,'Nova Explorer build notes\n- New Quick View filmstrip\n- Faster rendering\n- New animations');
  file('photos-backup.zip','downloads',482000000); file('installer.exe','downloads',68400000);

  // Documents
  file('Meeting Notes.txt','documents',2100,'Nova Explorer — Meeting Notes\n\n1. New sleek UI approved\n2. Quick View ships this week\n3. Real-folder browsing = killer feature');
  file('Annual Report 2026.pdf','documents',4200000); file('Budget.xlsx','documents',380000);
  file('Presentation.pptx','documents',8900000); file('Resume.pdf','documents',640000);
  const work = folder('Work Projects','documents','💼');
  file('roadmap.md', work.id, 3400, '# Nova Roadmap\n\n- [x] Sleek dark UI\n- [x] Quick View + filmstrip\n- [x] Tabs & command palette\n- [ ] Cloud sync');
  file('app.js', work.id, 12400, '// Nova Explorer\nconsole.log("fast ⚡");\nfunction render(){ /* virtualised list */ }');
  file('styles.css', work.id, 8200, ':root{ --accent:#6d7cff; }\nbody{ font-family: Inter, system-ui; }');

  // Pictures
  for(let i=1;i<=14;i++){ const f=file(`IMG_2026${String(i).padStart(4,'0')}.jpg`,'pictures',1800000+i*92000); f.modified=now-i*d*1.4; if(i%5===0) f.starred=true; }
  const trip = folder('Trip — Montréal','pictures','🏔️');
  for(let i=1;i<=6;i++) file(`trip-${i}.jpg`, trip.id, 2400000+i*50000);

  // Music & Videos
  [['Midnight Drive.mp3',5240000],['Lo-Fi Beats.mp3',4100000],['Synthwave Mix.flac',28400000],['Podcast Ep. 12.mp3',18400000]].forEach(([n,s])=>file(n,'music',s));
  [['City Timelapse.mp4',248000000],['Product Demo.mp4',96000000],['Family Trip.mov',512000000],['Tutorial — Getting Started.webm',74000000]].forEach(([n,s])=>file(n,'videos',s));
  save();
}
function save(){ try{ localStorage.setItem(DB_KEY, JSON.stringify(nodes)); }catch(e){} }
function load(){ try{ const raw=localStorage.getItem(DB_KEY); if(!raw) return false; const parsed=JSON.parse(raw); if(!parsed) return false; nodes={}; Object.values(parsed).forEach(n=>{ if(n && n.id) nodes[n.id]=n; }); return !!nodes.home; }catch(e){ return false; } }
if(!load()) seed();
const childrenOf = id => Object.values(nodes).filter(n=>n.parent===id);
const getNode = id => nodes[id];

/* ---------------- App state ---------------- */
const state = {
  view:{type:'folder', id:'downloads'}, // default: Downloads (like screenshot)
  viewMode: localStorage.getItem('nova-view')||'grid',
  sortBy:'name', sortDir:1, search:'', typeFilter:'all',
  selected:new Set(), lastSelIndex:-1, clipboard:null, tagFilter:null,
  real:null, // {rootName, stack:[{handle,name}], entries:[], handles:Map}
  qvIndex:-1, qvItems:[]
};
let tabs = [{view:{...state.view}, history:[{...state.view}], hIndex:0}];
let activeTab = 0;

/* ---------------- Navigation helpers ---------------- */
function currentView(){ return tabs[activeTab].view; }
function navigate(view, push=true){
  const t = tabs[activeTab];
  if(push && JSON.stringify(t.view)!==JSON.stringify(view)){ t.history = t.history.slice(0, t.hIndex+1); t.history.push(view); t.hIndex++; }
  t.view = view; state.view = view; state.selected.clear(); state.lastSelIndex=-1; state.tagFilter = view.type==='tag' ? view.tag : null;
  renderAll();
}
function goBack(){ const t=tabs[activeTab]; if(t.hIndex>0){ t.hIndex--; t.view=t.history[t.hIndex]; state.view=t.view; state.selected.clear(); renderAll(); } }
function goForward(){ const t=tabs[activeTab]; if(t.hIndex<t.history.length-1){ t.hIndex++; t.view=t.history[t.hIndex]; state.view=t.view; state.selected.clear(); renderAll(); } }
function viewTitle(v){
  if(v.type==='folder') return getNode(v.id)?.name || 'Folder';
  if(v.type==='real') return state.real ? state.real.stack[state.real.stack.length-1].name : 'PC Folder';
  return {recent:'Recent', starred:'Starred', trash:'Trash', search:'Search', tag:'Tag: '+v.tag}[v.type] || 'Folder';
}
function pathOf(id){ const parts=[]; let n=getNode(id); while(n && n.id!=='home'){ parts.unshift(n); n=getNode(n.parent); } return parts; }

/* Items for the current view, normalised */
function currentItems(){
  const v = currentView(); let items=[];
  if(v.type==='real' && state.real) items = state.real.entries;
  else if(v.type==='folder') items = childrenOf(v.id).map(n=>({...n, key:n.id}));
  else if(v.type==='recent') items = Object.values(nodes).filter(n=>!n.isFolder && n.parent!=='trash').sort((a,b)=>b.modified-a.modified).slice(0,40).map(n=>({...n,key:n.id}));
  else if(v.type==='starred') items = Object.values(nodes).filter(n=>n.starred && n.parent!=='trash').map(n=>({...n,key:n.id}));
  else if(v.type==='trash') items = childrenOf('trash').map(n=>({...n,key:n.id}));
  else if(v.type==='tag') items = Object.values(nodes).filter(n=>n.tags?.includes(v.tag) && n.parent!=='trash').map(n=>({...n,key:n.id}));
  else if(v.type==='search') items = Object.values(nodes).filter(n=>n.parent!=='trash' && n.name.toLowerCase().includes(v.query)).map(n=>({...n,key:n.id}));
  // search box + type filter (apply on every view)
  const q = state.search.trim().toLowerCase();
  if(q && v.type!=='search') items = items.filter(i=>i.name.toLowerCase().includes(q));
  if(state.typeFilter!=='all') items = items.filter(i=> state.typeFilter==='folder' ? i.isFolder : (i.kind||kindOf(i.name,i.isFolder))===state.typeFilter);
  const dir = state.sortDir, by = state.sortBy;
  items.sort((a,b)=>{
    if(a.isFolder!==b.isFolder) return a.isFolder ? -1 : 1;
    let r=0;
    if(by==='name') r=a.name.localeCompare(b.name,undefined,{numeric:true});
    else if(by==='size') r=(a.size||0)-(b.size||0);
    else if(by==='modified') r=(a.modified||0)-(b.modified||0);
    else if(by==='kind') r=(a.kind||'').localeCompare(b.kind||'') || a.name.localeCompare(b.name);
    return r*dir;
  });
  return items;
}

/* ---------------- Rendering ---------------- */
const fileContainer = $('#fileContainer');
function thumbHTML(item){
  const kind = item.kind || kindOf(item.name, item.isFolder);
  if(item.isFolder) return `<div class="thumb"><span class="file-ico">${item.icon||'🗂️'}</span></div>`;
  const src = blobURLs[item.id] || blobURLs[item.key] || item.thumb;
  if(kind==='image' && src) return `<div class="thumb"><img src="${src}" alt="" loading="lazy"></div>`;
  if(kind==='video' && src) return `<div class="thumb"><img src="${src}" alt="" loading="lazy"><span class="play-badge">▶</span></div>`;
  return `<div class="thumb"><span class="file-ico">${KIND_META[kind]?.icon||'📄'}</span>${kind==='video'?'<span class="play-badge">▶</span>':''}</div>`;
}
let viewItems = [];
function renderFiles(){
  viewItems = currentItems();
  const v = currentView();
  fileContainer.className = 'file-container ' + state.viewMode;
  $('#listHeader').classList.toggle('hidden', state.viewMode!=='list');
  $('#realBanner').classList.toggle('hidden', v.type!=='real');
  const frag = document.createDocumentFragment();
  viewItems.forEach((item, i)=>{
    const el = document.createElement('div');
    el.className = 'file-item' + (state.selected.has(item.key)?' selected':'') + (state.clipboard?.mode==='cut' && state.clipboard.ids.includes(item.key)?' cut':'');
    el.style.animationDelay = Math.min(i*22, 330)+'ms';
    el.dataset.key = item.key; el.draggable = v.type!=='real';
    const kind = item.kind || kindOf(item.name, item.isFolder);
    const count = item.isFolder && nodes[item.key] ? childrenOf(item.key).length : null;
    if(state.viewMode==='grid'){
      el.innerHTML = `${item.starred?'<span class="star-badge">★</span>':''}${item.tags?.length?`<span class="tag-dots">${item.tags.map(t=>`<i style="background:${t}"></i>`).join('')}</span>`:''}
        ${thumbHTML(item)}<div class="file-name" title="${esc(item.name)}">${esc(item.name)}</div>
        <div class="file-meta">${item.isFolder ? (count!=null? count+' items':'Folder') : fmtSize(item.size)}</div>`;
    } else {
      el.innerHTML = `<div class="file-main">${thumbHTML(item)}<div class="file-name" title="${esc(item.name)}">${esc(item.name)}${item.starred?' <span style="color:var(--warn)">★</span>':''}</div></div>
        <span class="cell">${count!=null? count : '—'}</span><span class="cell">${item.isFolder?'—':fmtSize(item.size)}</span>
        <span class="cell hide-m">${fmtDate(item.modified)}</span><span class="cell hide-m">${item.isFolder?'Folder':(KIND_META[kind]?.label||'File')+' · '+ (extOf(item.name)||'—').toUpperCase()}</span>
        <span class="row-actions"><button data-row="quick" title="Quick View (Space)">👁</button><button data-row="star" title="Star">★</button><button data-row="menu" title="More">⋯</button></span>`;
    }
    el.addEventListener('click', e=>onItemClick(e,item,i));
    el.addEventListener('dblclick', e=>{ e.preventDefault(); openItem(item); });
    el.addEventListener('contextmenu', e=>{ e.preventDefault(); if(!state.selected.has(item.key)){ state.selected.clear(); state.selected.add(item.key); renderFilesSoft(); } showItemMenu(e.clientX,e.clientY,item); });
    el.addEventListener('dragstart', e=>{ if(!state.selected.has(item.key)){state.selected.clear();state.selected.add(item.key);renderFilesSoft();} e.dataTransfer.setData('text/nova-ids', JSON.stringify([...state.selected])); e.dataTransfer.effectAllowed='move'; });
    el.addEventListener('dragover', e=>{ if(item.isFolder){ e.preventDefault(); el.style.borderColor='var(--accent)'; } });
    el.addEventListener('dragleave', ()=> el.style.borderColor='');
    el.addEventListener('drop', e=>{ if(item.isFolder){ e.preventDefault(); el.style.borderColor=''; const ids=JSON.parse(e.dataTransfer.getData('text/nova-ids')||'[]'); moveItems(ids, item.key); } });
    el.querySelectorAll('[data-row]').forEach(b=>b.addEventListener('click', e=>{ e.stopPropagation(); const a=b.dataset.row; if(a==='quick') openQuickView(viewItems.indexOf(item)); if(a==='star') toggleStar(item.key); if(a==='menu') showItemMenu(e.clientX,e.clientY,item); }));
    frag.appendChild(el);
  });
  fileContainer.replaceChildren(frag);
  $('#emptyState').classList.toggle('hidden', viewItems.length>0);
  if(!viewItems.length){
    const titles={trash:['Trash is empty','Deleted files will appear here. Restore or delete them forever.'],recent:['Nothing recent','Files you open or edit will show up here.'],starred:['No starred files','Star important files and they will live here.'],real:['This folder is empty','No files in this real folder (or access was denied).']};
    const t = titles[v.type] || ['This folder is empty','Create a new folder, upload files, or drag & drop files here.'];
    $('#emptyTitle').textContent=t[0]; $('#emptyText').textContent=t[1];
  }
  updateStatus(); renderPreview();
}
/* re-render selection styles without rebuilding (fast clicks) */
function renderFilesSoft(){
  $$('.file-item').forEach(el=>el.classList.toggle('selected', state.selected.has(el.dataset.key)));
  updateStatus(); renderPreview(); updateSelectionBar();
}
function renderBreadcrumb(){
  const v = currentView(); const bc = $('#breadcrumb'); bc.innerHTML='';
  const addCrumb = (label, view, current=false)=>{
    const b=document.createElement('button'); b.className='crumb'+(current?' current':''); b.textContent=label;
    b.onclick=()=>navigate(view); bc.appendChild(b);
  };
  const sep=()=>{ const s=document.createElement('span'); s.className='crumb-sep'; s.textContent='›'; bc.appendChild(s); };
  if(v.type==='real' && state.real){
    state.real.stack.forEach((s,i)=>{ if(i) sep(); const b=document.createElement('button'); b.className='crumb'+(i===state.real.stack.length-1?' current':''); b.textContent = i===0? '📂 '+s.name : s.name; b.onclick=()=>realGoTo(i); bc.appendChild(b); });
    return;
  }
  addCrumb('🏠 Home', {type:'folder',id:'home'}, v.type==='folder'&&v.id==='home');
  if(v.type==='folder' && v.id!=='home'){ pathOf(v.id).forEach((p,i,arr)=>{ sep(); addCrumb(p.name,{type:'folder',id:p.id}, i===arr.length-1); }); }
  else if(v.type!=='folder'){ sep(); const b=document.createElement('span'); b.className='crumb current'; b.textContent=viewTitle(v); bc.appendChild(b); }
}
const NAV_DEFS = [
  {sec:'quick', items:[['home','🏠','Home','home'],['recent','🕘','Recent',null],['starred','⭐','Starred',null],['downloads','⬇️','Downloads','downloads'],['desktop','🖥️','Desktop','desktop']]},
  {sec:'library', items:[['documents','📁','Documents','documents'],['pictures','🌄','Pictures','pictures'],['music','🎧','Music','music'],['videos','🎞️','Videos','videos'],['trash','🗑️','Trash','trash']]}
];
function renderNav(){
  const v=currentView();
  const build = defs => defs.map(([id,ico,label,folderId])=>{
    const btn=document.createElement('button');
    const isActive = folderId ? (v.type==='folder'&&v.id===folderId) : (v.type===id);
    btn.className='nav-item'+(isActive?' active':'');
    const count = id==='trash' ? childrenOf('trash').length : folderId ? childrenOf(folderId).length : id==='starred' ? Object.values(nodes).filter(n=>n.starred&&n.parent!=='trash').length : '';
    btn.innerHTML=`<span class="nav-ico">${ico}</span>${label}${count!==''?`<span class="nav-count">${count}</span>`:''}`;
    btn.onclick=()=>{ navigate(folderId?{type:'folder',id:folderId}:{type:id}); closeSidebarMobile(); };
    btn.addEventListener('dragover',e=>{ if(folderId){e.preventDefault(); btn.style.outline='2px solid var(--accent)';}});
    btn.addEventListener('dragleave',()=>btn.style.outline='');
    btn.addEventListener('drop',e=>{ btn.style.outline=''; const ids=JSON.parse(e.dataTransfer.getData('text/nova-ids')||'[]'); if(folderId&&ids.length) moveItems(ids, folderId==='trash'?'trash':folderId, folderId==='trash'); });
    return btn;
  });
  const q=$('#quickNav'); q.replaceChildren(...build(NAV_DEFS[0].items));
  const l=$('#libraryNav'); l.replaceChildren(...build(NAV_DEFS[1].items));
  const tags=[['#ff5d6c','Important'],['#ffb454','Work'],['#3ddc97','Personal'],['#6d7cff','Projects'],['#b16bff','Ideas']];
  $('#tagNav').replaceChildren(...tags.map(([color,name])=>{
    const b=document.createElement('button'); b.className='nav-item'+(state.tagFilter===color?' active':'');
    b.innerHTML=`<span class="nav-dot" style="background:${color}"></span>${name}<span class="nav-count">${Object.values(nodes).filter(n=>n.tags?.includes(color)).length}</span>`;
    b.onclick=()=>navigate({type:'tag',tag:color}); return b;
  }));
  // tabs
  const tc=$('#tabs'); tc.replaceChildren(...tabs.map((t,i)=>{
    const el=document.createElement('div'); el.className='tab'+(i===activeTab?' active':''); el.setAttribute('role','tab');
    el.innerHTML=`<span>${t.view.type==='folder'?(getNode(t.view.id)?.icon||'🗂️'):'◉'}</span><span>${esc(viewTitleForTab(t.view))}</span><button class="tab-x" title="Close tab">✕</button>`;
    el.onclick=e=>{ if(e.target.classList.contains('tab-x')){ closeTab(i); } else { activeTab=i; state.view=t.view; state.selected.clear(); renderAll(); } };
    el.oncontextmenu=e=>{e.preventDefault();}; return el;
  }));
  $('#btnBack').disabled = tabs[activeTab].hIndex<=0;
  $('#btnForward').disabled = tabs[activeTab].hIndex>=tabs[activeTab].history.length-1;
  const upDisabled = !(v.type==='folder' && getNode(v.id)?.parent) && v.type!=='real';
  $('#btnUp').disabled = upDisabled;
}
function viewTitleForTab(v){ if(v.type==='real') return state.real?.rootName||'PC Folder'; return viewTitle(v); }
function renderPreview(){
  const pane=$('#previewContent'); const sel=[...state.selected];
  if(sel.length!==1){ pane.innerHTML = sel.length>1
    ? `<div class="pv-empty"><span class="big-ico">🗂️</span><b style="color:var(--text)">${sel.length} items selected</b><br>${fmtSize(sel.reduce((s,k)=>s+(getNode(k)?.size||0),0))} total<br><br>Use the action bar or right-click<br>to copy, move or delete them together.</div>`
    : `<div class="pv-empty"><span class="big-ico">✦</span>Select a file to preview it here.<br><br><kbd>Space</kbd> quick view &nbsp;·&nbsp; <kbd>Ctrl K</kbd> commands<br><kbd>?</kbd> all shortcuts</div>`;
    return; }
  const item = viewItems.find(i=>i.key===sel[0]) || getNode(sel[0]); if(!item){pane.innerHTML='';return;}
  const kind=item.kind||kindOf(item.name,item.isFolder); const src=blobURLs[item.id]||item.thumb;
  let media = `<div class="pv-thumb"><span class="big-ico">${item.isFolder?(item.icon||'🗂️'):(KIND_META[kind]?.icon||'📄')}</span></div>`;
  if(kind==='image'&&src) media=`<div class="pv-thumb"><img src="${src}" alt=""></div>`;
  if(kind==='video'&&src) media=`<div class="pv-thumb"><img src="${src}" alt=""></div>`;
  pane.innerHTML = `${media}
    <div class="pv-name">${esc(item.name)} ${item.starred?'<span style="color:var(--warn)">★</span>':''}</div>
    <div class="pv-kind">${item.isFolder?'Folder':(KIND_META[kind]?.label||'File')}${extOf(item.name)?' · .'+extOf(item.name).toUpperCase():''}</div>
    <div class="pv-actions">
      <button class="btn primary" id="pvOpen">Open</button><button class="btn" id="pvQuick">Quick View</button>
      <button class="btn" id="pvStar">${item.starred?'Unstar':'★ Star'}</button><button class="btn" id="pvProps">Properties</button>
    </div>
    <table class="pv-table">
      <tr><td>Size</td><td>${item.isFolder? childrenOf(item.id).length+' items' : fmtSize(item.size)}</td></tr>
      <tr><td>Modified</td><td>${fmtDate(item.modified)}</td></tr>
      <tr><td>Location</td><td>${esc(locationLabel(item))}</td></tr>
      ${item.tags?.length?`<tr><td>Tags</td><td><span class="chips">${item.tags.map(t=>`<span class="chip" style="background:${t}">${tagName(t)}</span>`).join('')}</span></td></tr>`:''}
    </table>`;
  $('#pvOpen').onclick=()=>openItem(item);
  $('#pvQuick').onclick=()=>openQuickView(Math.max(0,viewItems.indexOf(item)));
  $('#pvStar').onclick=()=>toggleStar(item.key||item.id);
  $('#pvProps').onclick=()=>showProperties(item);
}
function tagName(c){ return {'#ff5d6c':'Important','#ffb454':'Work','#3ddc97':'Personal','#6d7cff':'Projects','#b16bff':'Ideas'}[c]||'Tag'; }
function locationLabel(item){ if(currentView().type==='real') return state.real?.stack.map(s=>s.name).join(' / ')||'PC'; const p=item.parent?getNode(item.parent):null; return p? (p.id==='home'?'Home':[...pathOf(p.id).map(x=>x.name)].join(' / ')) : 'Home'; }
function updateStatus(){
  const totalBytes=Object.values(nodes).filter(n=>!n.isFolder).reduce((s,n)=>s+(n.size||0),0);
  $('#statusLeft').textContent = `${viewItems.length} item${viewItems.length!==1?'s':''}`;
  const sel=[...state.selected];
  $('#statusMid').textContent = currentView().type==='real' ? 'Real folder · read-only preview' : 'Nova Library · saved locally in your browser';
  $('#statusRight').textContent = sel.length ? `${sel.length} selected · ${fmtSize(sel.reduce((s,k)=>s+(getNode(k)?.size||0),0))}` : '';
  $('#storageFill').style.width = Math.min(92, 18 + totalBytes/12e6)+'%';
  $('#storageText').textContent = `${fmtSize(totalBytes)} in library · ${Object.keys(nodes).length} items`;
  updateSelectionBar();
}
function updateSelectionBar(){
  const n=state.selected.size; $('#selectionActions').classList.toggle('hidden', n===0);
  if(n) $('#selCount').textContent = n+' selected';
  $('#btnPaste').classList.toggle('hidden', !state.clipboard);
  $('#btnPasteSel') && ($('#btnPasteSel').style.display = state.clipboard? '' : 'none');
}
function renderAll(){ renderNav(); renderBreadcrumb(); renderFiles(); }

/* ---------------- Selection ---------------- */
function onItemClick(e,item,index){
  if(e.ctrlKey||e.metaKey){ state.selected.has(item.key)?state.selected.delete(item.key):state.selected.add(item.key); }
  else if(e.shiftKey && state.lastSelIndex>=0){ state.selected.clear(); const [a,b]=[Math.min(state.lastSelIndex,index),Math.max(state.lastSelIndex,index)]; for(let i=a;i<=b;i++) state.selected.add(viewItems[i].key); }
  else { state.selected.clear(); state.selected.add(item.key); }
  state.lastSelIndex=index; renderFilesSoft();
}

/* ---------------- Open / actions ---------------- */
function openItem(item){
  if(!item) return;
  if(item.isFolder){
    if(currentView().type==='real'){ realEnter(item); return; }
    if(item.id==='trash'||item.key==='trash') return navigate({type:'folder',id:'trash'});
    navigate({type:'folder', id:item.key||item.id}); return;
  }
  const idx = viewItems.indexOf(item); openQuickView(idx>=0?idx:0);
}
function openQuickView(index, single){
  const list = single ? [single] : viewItems.filter(i=>!i.isFolder);
  if(!list.length) return;
  state.qvItems = list.length?list:viewItems;
  state.qvIndex = Math.min(Math.max(0,index - (single?0:viewItems.slice(0,index+1).filter(x=>x.isFolder).length)), state.qvItems.length-1);
  if(single) state.qvIndex=0;
  $('#quickView').classList.remove('hidden'); renderQuickView();
}
function renderQuickView(){
  const item=state.qvItems[state.qvIndex]; if(!item) return closeQuickView();
  const kind=item.kind||kindOf(item.name,item.isFolder); const src=blobURLs[item.id]||blobURLs[item.key]||item.thumb;
  $('#qvTitle').textContent = `Nova Explorer | Quick View — ${item.name}`;
  let body='';
  if(kind==='image'&&src) body=`<img class="preview-img" src="${src}" alt="${esc(item.name)}">`;
  else if(kind==='video'&&(blobURLs[item.id]||blobURLs[item.key])) body=`<video src="${blobURLs[item.id]||blobURLs[item.key]}" controls autoplay muted loop playsinline></video>`;
  else if(kind==='video'&&src) body=`<img class="preview-img" src="${src}" alt="">`;
  else if(kind==='audio'&&(blobURLs[item.id])) body=`<div><div class="qv-big-ico">🎵</div><audio src="${blobURLs[item.id]}" controls autoplay></audio><div class="qv-file-info"><b>${esc(item.name)}</b><br>${fmtSize(item.size)} · ${fmtDate(item.modified)}</div></div>`;
  else if(item.content!=null) body=`<div class="qv-doc"><pre>${esc(item.content)}</pre></div>`;
  else body=`<div><div class="qv-big-ico">${KIND_META[kind]?.icon||'📄'}</div><div class="qv-file-info"><b>${esc(item.name)}</b><br>${KIND_META[kind]?.label||'File'} · ${fmtSize(item.size)}<br>${fmtDate(item.modified)}<br><span style="color:#777c96">No preview available — use Download / Open with your apps after downloading.</span></div></div>`;
  $('#qvBody').innerHTML=body;
  $('#qvFilmstrip').innerHTML = state.qvItems.map((f,i)=>{
    const k=f.kind||kindOf(f.name,f.isFolder); const s=blobURLs[f.id]||f.thumb;
    return (k==='image'||k==='video')&&s ? `<img src="${s}" data-qv="${i}" class="${i===state.qvIndex?'active':''}" alt="">` : `<div class="qv-film ${i===state.qvIndex?'active':''}" data-qv="${i}">${KIND_META[k]?.icon||'📄'}</div>`;
  }).join('');
  $$('#qvFilmstrip [data-qv]').forEach(el=>el.onclick=()=>{ state.qvIndex=+el.dataset.qv; renderQuickView(); });
  $('#qvPrev').style.visibility = state.qvItems.length>1?'visible':'hidden';
  $('#qvNext').style.visibility = state.qvItems.length>1?'visible':'hidden';
  const active=$('#qvFilmstrip .active'); active?.scrollIntoView?.({inline:'center',block:'nearest',behavior:'smooth'});
}
function closeQuickView(){ $('#quickView').classList.add('hidden'); $('#qvBody').innerHTML=''; }
function qvStep(d){ if(state.qvItems.length<2) return; state.qvIndex=(state.qvIndex+d+state.qvItems.length)%state.qvItems.length; renderQuickView(); }
$('#qvClose').onclick=closeQuickView; $('#qvPrev').onclick=()=>qvStep(-1); $('#qvNext').onclick=()=>qvStep(1);
$('#quickView').addEventListener('click',e=>{ if(e.target.id==='quickView') closeQuickView(); });
$('#qvOpen').onclick=()=>{ const it=state.qvItems[state.qvIndex]; closeQuickView(); if(it&&!it.isFolder) downloadItem(it); };
$('#qvDownload').onclick=()=>{ const it=state.qvItems[state.qvIndex]; if(it) downloadItem(it); };
function downloadItem(item){
  const url = blobURLs[item.id] || item.thumb || (item.content!=null ? URL.createObjectURL(new Blob([item.content],{type:'text/plain'})) : null);
  if(!url){ toast('Nothing to download for this demo file — upload a real file to download it.'); return; }
  const a=document.createElement('a'); a.href=url; a.download=item.name; a.click(); toast(`Downloading ${item.name}`);
}

/* CRUD */
function uniqueName(base, parentId, selfId){
  if(!Object.values(nodes).some(n=>n.parent===parentId&&n.name===base&&n.id!==selfId)) return base;
  const ext=extOf(base); const stem=ext?base.slice(0,-(ext.length+1)):base;
  for(let i=2;;i++){ const c=ext?`${stem} ${i}.${ext}`:`${base} ${i}`; if(!Object.values(nodes).some(n=>n.parent===parentId&&n.name===c&&n.id!==selfId)) return c; }
}
function currentFolderId(){ const v=currentView(); return v.type==='folder'? v.id : 'home'; }
function createItem(isFolder, name, content){
  const parent=currentFolderId(); if(parent==='trash'){ toast('Cannot create files in Trash'); return; }
  const n=node({name:uniqueName(name||(isFolder?'New Folder':'New File.txt'),parent), parent, isFolder, size:isFolder?0:(content?.length||0), modified:Date.now(), kind:kindOf(name||'',isFolder)});
  if(!isFolder){ n.content = content ?? 'Start typing…\n\nCreated with Nova Explorer.'; if(n.kind==='image') n.thumb=artURI(name.length*9,name); }
  save(); renderAll(); state.selected.clear(); state.selected.add(n.id); renderFilesSoft(); toast(`${isFolder?'Folder':'File'} created`);
  return n;
}
function renameItem(id, newName){
  const n=getNode(id); if(!n||!newName.trim()) return;
  n.name=uniqueName(newName.trim(), n.parent, id); n.modified=Date.now(); n.kind=kindOf(n.name,n.isFolder);
  if(n.kind==='image'&&!blobURLs[id]) n.thumb=artURI(n.name.length*7,n.name);
  save(); renderAll(); toast('Renamed');
}
function deleteItems(ids, permanent=false){
  const prevParents = {}; ids.forEach(id=>{ if(getNode(id)) prevParents[id]=getNode(id).parent; });
  ids.forEach(id=>{
    const n=getNode(id); if(!n) return;
    if(permanent || n.parent==='trash'){ // recursive permanent
      const kill=x=>{ childrenOf(x).forEach(c=>kill(c.id)); delete nodes[x]; };
      kill(id);
    } else if(n.isFolder){ childrenOf(id).forEach(c=>{ c.parent='trash'; }); n.parent='trash'; }
    else n.parent='trash';
    if(blobURLs[id] && permanent){ URL.revokeObjectURL(blobURLs[id]); delete blobURLs[id]; }
  });
  state.selected.clear(); save(); renderAll();
  toast(permanent?'Deleted forever':'Moved to Trash', permanent?null:{label:'Undo', fn:()=>{ ids.forEach(id=>{ const n=getNode(id); if(n && prevParents[id]!=null) n.parent=prevParents[id]; }); save(); renderAll(); }});
}
function moveItems(ids, destId, toTrash=false){
  if(toTrash) return deleteItems(ids);
  let moved=0;
  ids.forEach(id=>{ const n=getNode(id); if(!n||id===destId) return; if(n.isFolder && pathOf(destId).some(p=>p.id===id)) return; n.parent=destId; n.name=uniqueName(n.name,destId,id); n.modified=Date.now(); moved++; });
  save(); renderAll(); if(moved) toast(`Moved ${moved} item${moved>1?'s':''} to ${getNode(destId)?.name}`);
}
function copyItems(ids, destId, cut=false){
  const clone=(src,parent)=>{
    const c=node({name:uniqueName(src.name,parent), parent, isFolder:src.isFolder, size:src.size, kind:src.kind, content:src.content, thumb:src.thumb, starred:false, tags:[...(src.tags||[])], modified:Date.now()});
    if(blobURLs[src.id]) blobURLs[c.id]=blobURLs[src.id];
    if(src.isFolder) childrenOf(src.id).forEach(ch=>clone(ch,c.id));
    return c;
  };
  ids.forEach(id=>{ const n=getNode(id); if(n) clone(n,destId); });
  if(cut) deleteItemsSilent(ids);
  save(); renderAll(); toast(cut?'Moved here':'Pasted');
}
function deleteItemsSilent(ids){ ids.forEach(id=>{ const kill=x=>{childrenOf(x).forEach(c=>kill(c.id)); delete nodes[x];}; kill(id); }); state.selected.clear(); }
function duplicateItems(ids){ ids.forEach(id=>{ const n=getNode(id); if(!n) return; const copy=node({name:uniqueName(n.name.replace(/(\.[^.]+)?$/,' copy$1'), n.parent), parent:n.parent, isFolder:n.isFolder, size:n.size, kind:n.kind, content:n.content, thumb:n.thumb, tags:[...(n.tags||[])], modified:Date.now()}); if(blobURLs[id]) blobURLs[copy.id]=blobURLs[id]; if(n.isFolder) childrenOf(id).forEach(ch=>{ const cc=node({name:ch.name,parent:copy.id,isFolder:ch.isFolder,size:ch.size,kind:ch.kind,content:ch.content,thumb:ch.thumb,modified:Date.now()}); if(blobURLs[ch.id]) blobURLs[cc.id]=blobURLs[ch.id]; }); }); save(); renderAll(); toast('Duplicated'); }
function toggleStar(id){ const n=getNode(id); if(!n) return; n.starred=!n.starred; save(); renderAll(); }
function setTag(id,color){ const n=getNode(id); if(!n) return; n.tags = n.tags?.includes(color)? n.tags.filter(t=>t!==color) : [...(n.tags||[]), color]; save(); renderAll(); }

/* ---------------- Modals ---------------- */
function showModal(title, bodyHTML, footButtons){
  $('#modalTitle').textContent=title; $('#modalBody').innerHTML=bodyHTML; const foot=$('#modalFoot'); foot.innerHTML='';
  (footButtons||[{label:'Close'}]).forEach(b=>{ const btn=document.createElement('button'); btn.className='btn'+(b.primary?' primary':'')+(b.danger?' danger':''); btn.textContent=b.label; btn.onclick=()=>{ if(b.fn) b.fn(); if(!b.keep) closeModal(); }; foot.appendChild(btn); });
  $('#modalBackdrop').classList.remove('hidden');
}
function closeModal(){ $('#modalBackdrop').classList.add('hidden'); }
$('#modalClose').onclick=closeModal; $('#modalBackdrop').addEventListener('click',e=>{ if(e.target.id==='modalBackdrop') closeModal(); });
function promptName(title,label,value,isFolder,cb){
  showModal(title, `<div class="field"><label>${label}</label><input id="mInput" value="${esc(value)}" autocomplete="off"></div>`,
    [{label:'Cancel'},{label:'Save',primary:true,fn:()=>cb($('#mInput').value)}]);
  const inp=$('#mInput'); setTimeout(()=>{ inp.focus(); inp.setSelectionRange(0, inp.value.lastIndexOf('.')>0 && !isFolder ? inp.value.lastIndexOf('.') : inp.value.length); },50);
  inp.onkeydown=e=>{ if(e.key==='Enter'){ cb(inp.value); closeModal(); } };
}
function confirmModal(title,text,okLabel,cb){
  showModal(title, `<p>${text}</p>`, [{label:'Cancel'},{label:okLabel,danger:true,primary:false,fn:cb}]);
}
function showProperties(item){
  const kind=item.kind||kindOf(item.name,item.isFolder);
  showModal('Properties', `<table class="pv-table">
    <tr><td>Name</td><td>${esc(item.name)}</td></tr><tr><td>Type</td><td>${item.isFolder?'Folder':KIND_META[kind]?.label+' (. '+extOf(item.name).toUpperCase()+')'}</td></tr>
    <tr><td>Size</td><td>${item.isFolder?childrenOf(item.id).length+' items':fmtSize(item.size)}</td></tr>
    <tr><td>Location</td><td>${esc(locationLabel(item))}</td></tr><tr><td>Modified</td><td>${fmtDate(item.modified)}</td></tr>
    <tr><td>Created</td><td>${fmtDate(item.created)}</td></tr><tr><td>Starred</td><td>${item.starred?'Yes ★':'No'}</td></tr></table>`,
    [{label:'Rename',fn:()=>promptName('Rename','New name',item.name,item.isFolder,v=>renameItem(item.id,v))},{label:'Close',primary:true}]);
}

/* ---------------- Menus ---------------- */
const ctx=$('#contextMenu'), dd=$('#dropdownMenu');
function openMenu(el,x,y,html){ el.innerHTML=html; el.classList.remove('hidden'); const r=el.getBoundingClientRect(); el.style.left=Math.min(x,innerWidth-r.width-10)+'px'; el.style.top=Math.min(y,innerHeight-r.height-10)+'px'; }
function closeMenus(){ ctx.classList.add('hidden'); dd.classList.add('hidden'); }
document.addEventListener('click',e=>{ if(!e.target.closest('.menu')) closeMenus(); });
const mi=(label,kbd,act,danger=false)=>`<button data-menu="${act}" class="${danger?'danger':''}">${label}${kbd?`<span class="menu-kbd">${kbd}</span>`:''}</button>`;
function showItemMenu(x,y,item){
  const v=currentView(); const inTrash=v.type==='folder'&&v.id==='trash'||item.parent==='trash'; const real=v.type==='real';
  let html='';
  if(real) html = mi('Quick View','Space','quick')+mi('Download','','download');
  else if(inTrash) html = mi('Restore','','restore')+`<hr>`+mi('Delete forever','','permdelete',true);
  else html = mi(item.isFolder?'Open':'Open / Quick View', item.isFolder?'Enter':'Space','open') + mi('Quick View','Space','quick') + `<hr>`
    + mi('Copy','Ctrl+C','copy')+mi('Cut','Ctrl+X','cut')+(state.clipboard?mi('Paste','Ctrl+V','paste'):'')+mi('Duplicate','','duplicate')+`<hr>`
    + mi(item.starred?'Unstar':'Star','','star') + `<div class="menu-head">Tag</div>` + ['#ff5d6c','#ffb454','#3ddc97','#6d7cff','#b16bff'].map(c=>`<button data-menu="tag:${c}"><span class="nav-dot" style="background:${c}"></span>${tagName(c)}${item.tags?.includes(c)?' ✓':''}</button>`).join('')
    + `<hr>`+mi('Rename','F2','rename')+mi('Properties','','props')+`<hr>`+mi('Delete','Del','delete',true);
  openMenu(ctx,x,y,html);
  ctx.querySelectorAll('[data-menu]').forEach(b=>b.onclick=()=>{ const a=b.dataset.menu; closeMenus(); menuAction(a,item); });
}
function menuAction(a,item){
  const ids=[...state.selected].length?[...state.selected]:[item.key||item.id];
  if(a==='open') openItem(item);
  else if(a==='quick') { if(item.isFolder) toast('Open the folder to preview its files'); else openQuickView(Math.max(0,viewItems.indexOf(item))); }
  else if(a==='download') downloadItem(item);
  else if(a==='copy'){ state.clipboard={mode:'copy',ids}; toast('Copied — go to a folder and Paste'); updateSelectionBar(); renderFilesSoft(); }
  else if(a==='cut'){ state.clipboard={mode:'cut',ids}; updateSelectionBar(); renderFilesSoft(); }
  else if(a==='paste') doPaste();
  else if(a==='duplicate') duplicateItems(ids);
  else if(a==='star') toggleStar(item.key||item.id);
  else if(a.startsWith('tag:')) setTag(item.key||item.id, a.slice(4));
  else if(a==='rename') promptName('Rename','New name',item.name,item.isFolder,v=>renameItem(item.id,v));
  else if(a==='props') showProperties(item);
  else if(a==='delete') deleteItems(ids);
  else if(a==='restore'){ ids.forEach(id=>{ const n=getNode(id); if(n) n.parent='downloads'; }); save(); renderAll(); toast('Restored to Downloads'); }
  else if(a==='permdelete') confirmModal('Delete forever?',`Permanently delete <b>${esc(item.name)}</b>? This cannot be undone.`,'Delete forever',()=>deleteItems(ids,true));
}
function doPaste(){
  if(!state.clipboard) return; const dest=currentFolderId();
  if(state.clipboard.mode==='copy') copyItems(state.clipboard.ids,dest,false);
  else { copyItems(state.clipboard.ids,dest,true); state.clipboard=null; }
  updateSelectionBar();
}
/* Background context menu */
fileContainer.parentElement.addEventListener('contextmenu',e=>{
  if(e.target.closest('.file-item')) return; e.preventDefault(); if(currentView().type==='real') return;
  openMenu(ctx,e.clientX,e.clientY, mi('New Folder','','newfolder')+mi('New File','','newfile')+mi('Upload files…','','upload')+`<hr>`+(state.clipboard?mi('Paste','Ctrl+V','paste'):'')+mi('Select All','Ctrl+A','selectall')+`<hr>`+mi('Refresh','F5','refresh')+mi('Properties of this folder','','folderprops'));
  ctx.querySelectorAll('[data-menu]').forEach(b=>b.onclick=()=>{ const a=b.dataset.menu; closeMenus();
    if(a==='newfolder') promptName('New Folder','Folder name','New Folder',true,v=>createItem(true,v));
    if(a==='newfile') promptName('New File','File name','New File.txt',false,v=>createItem(false,v));
    if(a==='upload') $('#fileUpload').click();
    if(a==='paste') doPaste();
    if(a==='selectall'){ viewItems.forEach(i=>state.selected.add(i.key)); renderFilesSoft(); }
    if(a==='refresh') refreshFX();
    if(a==='folderprops'){ const f=getNode(currentFolderId()); if(f) showProperties({...f,key:f.id}); }
  });
});

/* ---------------- Toolbar wiring ---------------- */
$('#btnBack').onclick=goBack; $('#btnForward').onclick=goForward; $('#btnRefresh').onclick=()=>refreshFX();
$('#btnUp').onclick=()=>{ const v=currentView(); if(v.type==='real') realGoTo(state.real.stack.length-2); else if(v.type==='folder'){ const p=getNode(v.id)?.parent; if(p) navigate({type:'folder',id:p}); } };
function refreshFX(){ renderAll(); toast('Refreshed'); }
$('#btnEditPath').onclick=()=>{
  const v=currentView(); if(v.type==='real') return;
  const inp=$('#pathInput'); inp.classList.remove('hidden'); $('#breadcrumb').classList.add('hidden');
  inp.value = v.type==='folder' ? 'Home'+pathOf(v.id).map(p=>' / '+p.name).join('') : viewTitle(v); inp.focus(); inp.select();
  const done=()=>{ inp.classList.add('hidden'); $('#breadcrumb').classList.remove('hidden');
    const parts=inp.value.split('/').map(s=>s.trim()).filter(Boolean);
    let cur='home'; for(const part of parts.slice(1)){ const c=childrenOf(cur).find(n=>n.isFolder&&n.name.toLowerCase()===part.toLowerCase()); if(c) cur=c.id; else break; }
    if(parts.length) navigate({type:'folder',id:cur});
  };
  inp.onkeydown=e=>{ if(e.key==='Enter') done(); if(e.key==='Escape'){ inp.classList.add('hidden'); $('#breadcrumb').classList.remove('hidden'); } };
  inp.onblur=()=>setTimeout(()=>{ if(!inp.classList.contains('hidden')){ inp.classList.add('hidden'); $('#breadcrumb').classList.remove('hidden'); } },150);
};
let searchTimer; $('#searchInput').addEventListener('input',e=>{ clearTimeout(searchTimer); searchTimer=setTimeout(()=>{ state.search=e.target.value; renderFiles(); },140); });
$('#typeFilter').onchange=e=>{ state.typeFilter=e.target.value; renderFiles(); };
$('#viewGrid').onclick=()=>setView('grid'); $('#viewList').onclick=()=>setView('list');
function setView(m){ state.viewMode=m; localStorage.setItem('nova-view',m); $('#viewGrid').classList.toggle('active',m==='grid'); $('#viewList').classList.toggle('active',m==='list'); renderFiles(); }
$('#sortLabel').textContent='Name';
$('#btnSort').onclick=e=>{
  const sorts=[['name','Name'],['size','Size'],['modified','Date modified'],['kind','Kind']];
  openMenu(dd,e.clientX,e.clientY, `<div class="menu-head">Sort by</div>`+sorts.map(([k,l])=>`<button data-s="${k}">${state.sortBy===k?'✓ ':''}${l}</button>`).join('')+`<hr><button data-s="dir">${state.sortDir===1?'↑ Ascending':'↓ Descending'} — switch</button>`);
  dd.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{ const k=b.dataset.s; if(k==='dir') state.sortDir*=-1; else { if(state.sortBy===k) state.sortDir*=-1; else {state.sortBy=k; state.sortDir=1;} $('#sortLabel').textContent=b.textContent.replace('✓ ',''); } closeMenus(); renderFiles(); });
};
$$('#listHeader [data-sort]').forEach(b=>b.onclick=()=>{ const k=b.dataset.sort; if(state.sortBy===k) state.sortDir*=-1; else{state.sortBy=k;state.sortDir=1;} renderFiles(); });
$('#btnNew').onclick=e=>{
  openMenu(dd,e.clientX,e.clientY, mi('📁 New Folder','Ctrl+Shift+N','folder')+mi('📄 New Text File','','txt')+mi('🖼️ New Image','','img')+mi('🎬 New Video placeholder','','vid')+`<hr>`+mi('⤒ Upload files…','','upload'));
  dd.querySelectorAll('[data-menu]').forEach(b=>b.onclick=()=>{ const a=b.dataset.menu; closeMenus();
    if(a==='folder') promptName('New Folder','Folder name','New Folder',true,v=>createItem(true,v));
    if(a==='txt') promptName('New File','File name','New File.txt',false,v=>createItem(false,v));
    if(a==='img') createItem(false,'New Image.png');
    if(a==='vid') createItem(false,'New Video.mp4');
    if(a==='upload') $('#fileUpload').click();
  });
};
$('#btnUpload').onclick=()=>$('#fileUpload').click();
$('#fileUpload').onchange=e=>{ handleFiles([...e.target.files]); e.target.value=''; };
$('#btnPaste').onclick=doPaste;
$('#selectionActions').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]'); if(!b) return; const a=b.dataset.act; const ids=[...state.selected]; const first=viewItems.find(i=>i.key===ids[0]);
  if(a==='open'&&first) openItem(first);
  if(a==='copy'){ state.clipboard={mode:'copy',ids}; toast('Copied'); }
  if(a==='cut'){ state.clipboard={mode:'cut',ids}; toast('Cut — Paste to move'); }
  if(a==='paste') doPaste();
  if(a==='rename'&&ids.length===1&&first) promptName('Rename','New name',first.name,first.isFolder,v=>renameItem(first.id,v));
  if(a==='rename'&&ids.length>1) toast('Select one file to rename');
  if(a==='duplicate') duplicateItems(ids);
  if(a==='star') ids.forEach(id=>{const n=getNode(id); if(n) n.starred=true;}); save(),renderAll();
  if(a==='delete') deleteItems(ids);
  updateSelectionBar(); renderFilesSoft();
});
/* Tabs */
$('#btnNewTab').onclick=()=>{ tabs.push({view:{type:'folder',id:'home'},history:[{type:'folder',id:'home'}],hIndex:0}); activeTab=tabs.length-1; state.view=tabs[activeTab].view; state.selected.clear(); renderAll(); };
function closeTab(i){ if(tabs.length===1){ toast('Last tab'); return; } tabs.splice(i,1); activeTab=Math.min(activeTab,tabs.length-1); state.view=tabs[activeTab].view; state.selected.clear(); renderAll(); }
$('#btnPreviewToggle').onclick=e=>{ const p=$('#previewPane'); p.classList.toggle('closed'); p.classList.toggle('force', innerWidth<=1100 && !p.classList.contains('closed')); e.currentTarget.classList.toggle('active'); };

/* Drag & drop upload + rubber band */
const dz=$('#dropZone');
['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{ if(e.dataTransfer?.types?.includes('Files')){ e.preventDefault(); $('#dropOverlay').classList.remove('hidden'); } }));
['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{ if(ev==='drop'||e.target===dz) $('#dropOverlay').classList.add('hidden'); }));
dz.addEventListener('drop',e=>{ const files=[...e.dataTransfer.files]; if(files.length){ e.preventDefault(); handleFiles(files); } });
async function handleFiles(files){
  if(currentView().type==='real'){ toast('Real-folder mode is read-only here — switch to Library to add uploads'); return; }
  const parent=currentFolderId(); let added=0;
  for(const f of files){
    const n=node({name:uniqueName(f.name,parent), parent, isFolder:false, size:f.size, kind:kindOf(f.name,false), modified:f.lastModified||Date.now()});
    blobURLs[n.id]=URL.createObjectURL(f);
    if(n.kind==='image'||n.kind==='video') n.thumb=blobURLs[n.id];
    if(f.type.startsWith('text')||['txt','md','js','css','json','csv'].includes(extOf(f.name))) { try{ n.content=await f.text(); }catch(e){} }
    added++;
  }
  save(); renderAll(); toast(`Added ${added} file${added>1?'s':''}`);
}
/* rubber-band select (grid/list background drag) */
let rb=null;
dz.addEventListener('mousedown',e=>{
  if(e.button!==0||e.target.closest('.file-item,button,input,select,a')) return;
  const r=dz.getBoundingClientRect(); rb={x:e.clientX-r.left+dz.scrollLeft, y:e.clientY-r.top+dz.scrollTop, el:$('#rubberBand')};
  rb.el.classList.remove('hidden');
});
dz.addEventListener('mousemove',e=>{
  if(!rb) return; const r=dz.getBoundingClientRect(); const x=e.clientX-r.left+dz.scrollLeft, y=e.clientY-r.top+dz.scrollTop;
  const [x1,y1,x2,y2]=[Math.min(rb.x,x),Math.min(rb.y,y),Math.max(rb.x,x),Math.max(rb.y,y)];
  Object.assign(rb.el.style,{left:x1+'px',top:y1+'px',width:(x2-x1)+'px',height:(y2-y1)+'px'});
  if(!e.ctrlKey&&!e.metaKey) state.selected.clear();
  $$('.file-item').forEach(el=>{ const er=el.getBoundingClientRect(); const ex=er.left-r.left+dz.scrollLeft, ey=er.top-r.top+dz.scrollTop;
    if(ex< x2 && ex+er.width> x1 && ey< y2 && ey+er.height> y1) state.selected.add(el.dataset.key); });
  renderFilesSoft();
});
addEventListener('mouseup',()=>{ if(rb){ rb.el.classList.add('hidden'); rb=null; } });

/* ---------------- Real folder (File System Access API) ---------------- */
async function refreshReal(){
  if(!state.real) return;
  const dir=state.real.stack[state.real.stack.length-1].handle; const entries=[];
  try{
    for await(const [name,handle] of dir.entries()){
      const isFolder=handle.kind==='directory'; let size=null,modified=null;
      const key='real:'+state.real.stack.map(s=>s.name).join('/')+'/'+name;
      if(!isFolder){ try{ const f=await handle.getFile(); size=f.size; modified=f.lastModified; if(kindOf(name,false)==='image') blobURLs[key]=URL.createObjectURL(f); }catch(e){} }
      entries.push({key, id:key, name, isFolder, kind:kindOf(name,isFolder), size, modified, handle, real:true});
    }
  }catch(e){ toast('Could not read that folder'); }
  state.real.entries=entries.sort((a,b)=>(a.isFolder===b.isFolder? a.name.localeCompare(b.name): a.isFolder?-1:1));
  renderAll();
}
async function openRealFolder(){
  if(!window.showDirectoryPicker){ showModal('Open a real folder','<p>Your browser does not support the File System Access API.</p><p style="margin-top:8px">Use <b>Chrome</b> or <b>Edge</b> on desktop to browse a real folder from your PC. In other browsers you can still:</p><p>• Drag &amp; drop real files into Nova (they preview instantly)<br>• Use <b>Upload</b> to add real files to the library</p>',[{label:'Use Upload instead',fn:()=>$('#fileUpload').click()},{label:'OK',primary:true}]); return; }
  try{
    const handle=await window.showDirectoryPicker();
    state.real={rootName:handle.name, stack:[{handle,name:handle.name}], entries:[]};
    tabs[activeTab].view={type:'real'}; state.selected.clear(); await refreshReal(); toast(`Browsing ${handle.name} from your PC`);
  }catch(e){ /* user cancelled */ }
}
$('#btnOpenReal').onclick=openRealFolder;
$('#btnExitReal').onclick=()=>{ state.real=null; navigate({type:'folder',id:'home'}); };
async function realEnter(item){
  state.real.stack.push({handle:item.handle,name:item.name}); state.selected.clear(); await refreshReal();
}
async function realGoTo(index){ if(!state.real||index<0) return; state.real.stack=state.real.stack.slice(0,index+1); state.selected.clear(); await refreshReal(); }
/* click on a real file = preview via blob URL */
const _openItem=openItem;
openItem = async function(item){ // eslint-disable-line
  if(item && item.real && !item.isFolder){
    try{ const f=await item.handle.getFile(); const url=URL.createObjectURL(f); blobURLs[item.id||item.key]=url;
      const kind=kindOf(item.name,false);
      if(kind==='image') item.thumb=url;
      if(f.type.startsWith('text')||['txt','md','js','css','json','csv'].includes(extOf(item.name))) item.content=await f.text();
      item.id=item.key;
      openQuickView(0,item); return;
    }catch(e){ toast('Could not open that file'); return; }
  }
  return _openItem(item);
};

/* ---------------- Command palette ---------------- */
const commands=[
  ['New Folder','Create a folder here',()=>promptName('New Folder','Folder name','New Folder',true,v=>createItem(true,v))],
  ['New File','Create a text file',()=>promptName('New File','File name','New File.txt',false,v=>createItem(false,v))],
  ['Upload Files','Add files from your device',()=>$('#fileUpload').click()],
  ['Open Folder from PC','Browse a real folder (Chrome/Edge)',openRealFolder],
  ['Go to Downloads','',()=>navigate({type:'folder',id:'downloads'})],
  ['Go to Pictures','',()=>navigate({type:'folder',id:'pictures'})],
  ['Go to Documents','',()=>navigate({type:'folder',id:'documents'})],
  ['Go to Trash','',()=>navigate({type:'folder',id:'trash'})],
  ['Toggle Theme','Dark / Light',()=>toggleTheme()],
  ['Grid View','',()=>setView('grid')],['List View','',()=>setView('list')],
  ['Select All','Ctrl+A',()=>{viewItems.forEach(i=>state.selected.add(i.key));renderFilesSoft();}],
  ['Empty Trash','Delete everything in Trash forever',()=>confirmModal('Empty Trash?','Permanently delete everything in Trash?','Empty Trash',()=>{childrenOf('trash').forEach(c=>delete nodes[c.id]); save(); renderAll(); toast('Trash emptied');})],
  ['Keyboard Shortcuts','See all shortcuts',showShortcuts],
  ['Reset Demo Library','Restore the sample files',()=>confirmModal('Reset library?','This replaces your library with the original demo files.','Reset',()=>{localStorage.removeItem(DB_KEY); seed(); state.selected.clear(); navigate({type:'folder',id:'downloads'}); toast('Library reset');})],
];
function openPalette(){ $('#palette').classList.remove('hidden'); $('#paletteInput').value=''; renderPalette(''); setTimeout(()=>$('#paletteInput').focus(),40); }
function closePalette(){ $('#palette').classList.add('hidden'); }
function renderPalette(q){
  q=q.toLowerCase(); const cmdHits=commands.filter(c=>c[0].toLowerCase().includes(q)).map(c=>({label:c[0],sub:c[1],fn:c[2],icon:'⚡'}));
  const fileHits=q? Object.values(nodes).filter(n=>n.parent!=='trash'&&n.name.toLowerCase().includes(q)).slice(0,8).map(n=>({label:n.name,sub:n.isFolder?'Folder':'File · '+fmtSize(n.size),icon:n.isFolder?'🗂️':'📄',fn:()=> n.isFolder?navigate({type:'folder',id:n.id}):(state.selected.clear(),state.selected.add(n.id),openQuickView(0,{...n,key:n.id}))})) : [];
  const hits=[...cmdHits,...fileHits]; const box=$('#paletteResults');
  box.innerHTML= hits.length? hits.map((h,i)=>`<button class="palette-item ${i===0?'active':''}" data-i="${i}"><span>${h.icon}</span>${esc(h.label)}<small>${esc(h.sub||'')}</small></button>`).join('') : '<p style="padding:14px;color:var(--faint);font-size:13px">No results</p>';
  box.querySelectorAll('.palette-item').forEach((el,i)=>el.onclick=()=>{ closePalette(); hits[i].fn(); });
  box._hits=hits; box._sel=0;
}
$('#paletteInput').addEventListener('input',e=>renderPalette(e.target.value));
$('#paletteInput').addEventListener('keydown',e=>{
  const box=$('#paletteResults'); const hits=box._hits||[]; let sel=box._sel||0;
  if(e.key==='ArrowDown'){ e.preventDefault(); sel=Math.min(sel+1,hits.length-1); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); sel=Math.max(sel-1,0); }
  else if(e.key==='Enter'&&hits[sel]){ closePalette(); hits[sel].fn(); return; } else return;
  box._sel=sel; box.querySelectorAll('.palette-item').forEach((el,i)=>el.classList.toggle('active',i===sel));
});
$('#btnPalette').onclick=openPalette;
$('#palette').addEventListener('click',e=>{ if(e.target.id==='palette') closePalette(); });

/* ---------------- Theme / settings / shortcuts ---------------- */
function toggleTheme(){ const h=document.documentElement; const next=h.dataset.theme==='dark'?'light':'dark'; h.dataset.theme=next; localStorage.setItem('nova-theme',next); }
document.documentElement.dataset.theme = localStorage.getItem('nova-theme')||'dark';
$('#btnTheme').onclick=toggleTheme;
function showShortcuts(){
  showModal('Keyboard Shortcuts', `<div class="shortcuts-grid">
    <span>Quick View</span><span><kbd>Space</kbd></span><span>Command palette</span><span><kbd>Ctrl</kbd> <kbd>K</kbd></span>
    <span>New tab</span><span><kbd>Ctrl</kbd> <kbd>T</kbd></span><span>Search</span><span><kbd>/</kbd></span>
    <span>Select all</span><span><kbd>Ctrl</kbd> <kbd>A</kbd></span><span>Copy / Cut / Paste</span><span><kbd>Ctrl</kbd> <kbd>C</kbd>/<kbd>X</kbd>/<kbd>V</kbd></span>
    <span>Rename</span><span><kbd>F2</kbd></span><span>Delete</span><span><kbd>Del</kbd></span>
    <span>Back / Forward</span><span><kbd>Alt</kbd> <kbd>←</kbd>/<kbd>→</kbd></span><span>Up</span><span><kbd>Alt</kbd> <kbd>↑</kbd></span>
    <span>Grid / List</span><span><kbd>Ctrl</kbd> <kbd>1</kbd>/<kbd>2</kbd></span><span>Preview pane</span><span><kbd>Ctrl</kbd> <kbd>P</kbd></span>
    <span>Toggle theme</span><span><kbd>T</kbd></span><span>Close dialogs</span><span><kbd>Esc</kbd></span></div>`,[{label:'Done',primary:true}]);
}
$('#btnShortcuts').onclick=showShortcuts;
$('#btnSettings').onclick=e=>{
  openMenu(dd, e.clientX, innerHeight-190, `<div class="menu-head">Settings</div>`+mi(document.documentElement.dataset.theme==='dark'?'☀️ Light theme':'🌙 Dark theme','','theme')+mi('Toggle preview pane','Ctrl+P','pane')+mi(document.body.classList.contains('compact')?'Comfortable density':'Compact density','','density')+`<hr>`+mi('Empty Trash','','emptytrash',true)+mi('Reset demo library','','reset',true));
  dd.querySelectorAll('[data-menu]').forEach(b=>b.onclick=()=>{ const a=b.dataset.menu; closeMenus();
    if(a==='theme') toggleTheme(); if(a==='pane') $('#btnPreviewToggle').click();
    if(a==='density') document.body.classList.toggle('compact');
    if(a==='emptytrash') commands.find(c=>c[0]==='Empty Trash')[2]();
    if(a==='reset') commands.find(c=>c[0]==='Reset Demo Library')[2]();
  });
};
$('#btnStorageInfo').onclick=()=>{ const all=Object.values(nodes).filter(n=>!n.isFolder); const by=k=>fmtSize(all.filter(n=>n.kind===k).reduce((s,n)=>s+n.size,0));
  showModal('Storage Details',`<table class="pv-table"><tr><td>Images</td><td>${by('image')}</td></tr><tr><td>Videos</td><td>${by('video')}</td></tr><tr><td>Documents</td><td>${by('document')}</td></tr><tr><td>Audio</td><td>${by('audio')}</td></tr><tr><td>Total files</td><td>${all.length}</td></tr></table><p style="margin-top:10px">Your library is stored locally in this browser (localStorage). Uploaded file previews live for this session.</p>`,[{label:'OK',primary:true}]); };

/* Sidebar mobile */
function closeSidebarMobile(){ $('#sidebar').classList.remove('open'); $('#sidebarScrim').classList.remove('show'); }
$('#btnMenu').onclick=()=>{ $('#sidebar').classList.add('open'); $('#sidebarScrim').classList.add('show'); };
$('#btnCollapse').onclick=closeSidebarMobile; $('#sidebarScrim').onclick=closeSidebarMobile;
$('#realSupportHint').textContent = window.showDirectoryPicker ? 'Browse real files (Chrome/Edge)' : 'Not supported in this browser — use Upload';

/* ---------------- Toast ---------------- */
function toast(msg, action){
  const t=document.createElement('div'); t.className='toast'; t.innerHTML=`<span>${esc(msg)}</span>${action?`<button>${esc(action.label)}</button>`:''}`;
  if(action) t.querySelector('button').onclick=()=>{ action.fn(); dismiss(); };
  $('#toasts').appendChild(t); const dismiss=()=>{ t.classList.add('out'); setTimeout(()=>t.remove(),260); };
  setTimeout(dismiss, 3400);
}

/* ---------------- Keyboard ---------------- */
addEventListener('keydown',e=>{
  const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');
  if(!$('#palette').classList.contains('hidden')){ if(e.key==='Escape') closePalette(); return; }
  if(!$('#quickView').classList.contains('hidden')){
    if(e.key==='Escape'||e.key===' '){ e.preventDefault(); closeQuickView(); }
    if(e.key==='ArrowRight') qvStep(1); if(e.key==='ArrowLeft') qvStep(-1); return;
  }
  if(!$('#modalBackdrop').classList.contains('hidden')){ if(e.key==='Escape') closeModal(); return; }
  if(e.key===' '&&!typing){ const sel=[...state.selected]; if(sel.length===1){ e.preventDefault(); const it=viewItems.find(i=>i.key===sel[0]); if(it&&!it.isFolder) openItem(it); } return; }
  if(typing) return;
  const mod=e.ctrlKey||e.metaKey;
  if(mod&&e.key.toLowerCase()==='k'){ e.preventDefault(); openPalette(); }
  else if(mod&&e.key.toLowerCase()==='t'){ e.preventDefault(); $('#btnNewTab').click(); }
  else if(mod&&e.key.toLowerCase()==='a'){ e.preventDefault(); viewItems.forEach(i=>state.selected.add(i.key)); renderFilesSoft(); }
  else if(mod&&e.key.toLowerCase()==='c'){ const ids=[...state.selected]; if(ids.length){ state.clipboard={mode:'copy',ids}; toast('Copied'); updateSelectionBar(); renderFilesSoft(); } }
  else if(mod&&e.key.toLowerCase()==='x'){ const ids=[...state.selected]; if(ids.length){ state.clipboard={mode:'cut',ids}; toast('Cut'); updateSelectionBar(); renderFilesSoft(); } }
  else if(mod&&e.key.toLowerCase()==='v'){ doPaste(); }
  else if(mod&&e.key==='1') setView('grid'); else if(mod&&e.key==='2') setView('list');
  else if(mod&&e.key.toLowerCase()==='p'){ e.preventDefault(); $('#btnPreviewToggle').click(); }
  else if(e.key==='F2'){ const ids=[...state.selected]; const it=viewItems.find(i=>i.key===ids[0]); if(it&&ids.length===1) promptName('Rename','New name',it.name,it.isFolder,v=>renameItem(it.id,v)); }
  else if(e.key==='Delete'||e.key==='Backspace'){ const ids=[...state.selected]; if(ids.length&&currentView().type!=='real') deleteItems(ids); }
  else if(e.key==='Enter'){ const ids=[...state.selected]; const it=viewItems.find(i=>i.key===ids[0]); if(it&&ids.length===1) openItem(it); }
  else if(e.key==='/' ){ e.preventDefault(); $('#searchInput').focus(); }
  else if(e.key==='?') showShortcuts();
  else if(e.key.toLowerCase()==='t'&&!mod) toggleTheme();
  else if(e.altKey&&e.key==='ArrowLeft'){ e.preventDefault(); goBack(); }
  else if(e.altKey&&e.key==='ArrowRight'){ e.preventDefault(); goForward(); }
  else if(e.altKey&&e.key==='ArrowUp'){ e.preventDefault(); $('#btnUp').click(); }
  else if(['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(e.key) && viewItems.length){
    e.preventDefault(); let idx=state.lastSelIndex<0?0:state.lastSelIndex;
    const cols = state.viewMode==='grid' ? Math.max(1,Math.round(fileContainer.clientWidth/154)) : 1;
    if(e.key==='ArrowRight') idx=Math.min(viewItems.length-1,idx+1);
    if(e.key==='ArrowLeft') idx=Math.max(0,idx-1);
    if(e.key==='ArrowDown') idx=Math.min(viewItems.length-1,idx+cols);
    if(e.key==='ArrowUp') idx=Math.max(0,idx-cols);
    state.selected.clear(); state.selected.add(viewItems[idx].key); state.lastSelIndex=idx; renderFilesSoft();
    $$(`.file-item`)[idx]?.scrollIntoView?.({block:'nearest'});
  }
});
/* Click empty area clears selection */
dz.addEventListener('click',e=>{ if(!e.target.closest('.file-item')){ state.selected.clear(); renderFilesSoft(); } });

/* ---------------- Init ---------------- */
setView(state.viewMode==='list'?'list':'grid');
renderAll();
if(!window.showDirectoryPicker) setTimeout(()=>toast('Tip: use Chrome/Edge for "Open folder from PC", or drag & drop files in'),600);
