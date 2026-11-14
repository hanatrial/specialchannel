// Visit Special Channel — standalone tool, shares the MDS Visit Firebase project.
const FIREBASE_CONFIG={apiKey:"AIzaSyCtYc8uZICLzQrA1b7l00Yo_9V_rqNVOu0",authDomain:"mds-visit.firebaseapp.com",projectId:"mds-visit",storageBucket:"mds-visit.firebasestorage.app",messagingSenderId:"732603054928",appId:"1:732603054928:web:9f946bfa13d56d860a8a55"};
const COLLECTION='special_channel_logs';
let db=null;
try{firebase.initializeApp(FIREBASE_CONFIG);db=firebase.firestore();db.enablePersistence({synchronizeTabs:true}).catch(()=>{});}catch(e){console.warn('Firebase init failed',e);}

const ACTIVITIES=[
  {k:'so',label:'Taking Sales Order ke Distributor',icon:'🧾'},
  {k:'visit',label:'Visit',icon:'🚶'},
  {k:'sample',label:'Sample Merchant',icon:'🎁'},
];
const CHANNELS=[
  {k:'gym',label:'Gym & Sport Center',icon:'🏋️'},
  {k:'horeka',label:'Horeka',icon:'🏨'},
];
const label=(list,k)=>(list.find(x=>x.k===k)||{}).label||k;

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2600);}

// ── state ──
const S={activity:null,channel:null,gps:null,photos:{display:null,comp:null},items:{}}; // items: name -> {av, ord}

function chips(el,list,key){
  el.innerHTML=list.map(o=>`<button type="button" class="chip" data-k="${o.k}"><span>${o.icon}</span>${esc(o.label)}</button>`).join('');
  el.onclick=e=>{const b=e.target.closest('.chip');if(!b)return;S[key]=b.dataset.k;[...el.children].forEach(c=>c.classList.toggle('on',c===b));
    if(key==='channel'){ // drop ticked items that don't belong to the new channel
      for(const it of Object.keys(S.items)){const p=ITEM_BY_NAME[it];if(p&&p.type!=='all'&&p.type!==S.channel)delete S.items[it];}
      renderProducts();
    }};
}
const ITEM_BY_NAME=Object.fromEntries(window.ITEMS.map(p=>[p.name,p]));
// group items by category, keeping sheet order
function groupsFor(channel){
  const m=new Map();
  for(const p of window.ITEMS){if(p.type!=='all'&&p.type!==channel)continue;if(!m.has(p.cat))m.set(p.cat,[]);m.get(p.cat).push(p.name);}
  return [...m].map(([group,items])=>({group,items}));
}
chips($('activity'),ACTIVITIES,'activity');
chips($('channel'),CHANNELS,'channel');

$('mds').value=store.get('sc_mds')||'';
const today=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);};
$('vdate').value=today();

// ── products ──
let GROUPS=[];
function renderProducts(){
  const q=$('q').value.trim().toLowerCase();
  if(!S.channel){$('products').innerHTML='<div class="empty">Pilih Channel dulu untuk melihat produk</div>';$('q').classList.add('hidden');return;}
  $('q').classList.remove('hidden');
  const list=window.ITEMS.filter(p=>(p.type==='all'||p.type===S.channel)&&(!q||(p.name+' '+p.cat).toLowerCase().includes(q)));
  $('products').innerHTML=list.length?`<div class="it ith"><span class="nm">Produk</span><span class="c">Ada</span><span class="o">Order</span></div>`+
    list.map(p=>{const it=p.name,v=S.items[it]||{};return `<div class="it">
      <span class="nm">${esc(it)}<span class="cat">${esc(p.cat)}</span></span>
      <span class="c"><input type="checkbox" data-it="${esc(it)}" ${v.av?'checked':''}></span>
      <input type="number" class="o" data-ord="${esc(it)}" inputmode="numeric" min="0" placeholder="0" value="${v.ord||''}">
    </div>`}).join(''):'<div class="empty">Produk tidak ditemukan</div>';
}
$('q').oninput=renderProducts;
function setItem(it,patch){
  const v={...(S.items[it]||{}),...patch};
  if(!v.av&&!v.ord)delete S.items[it];else S.items[it]=v;
}
$('products').addEventListener('change',e=>{const cb=e.target.closest('input[data-it]');if(cb)setItem(cb.dataset.it,{av:cb.checked});});
$('products').addEventListener('input',e=>{const o=e.target.closest('input[data-ord]');if(o)setItem(o.dataset.ord,{ord:o.value});});
renderProducts();

// ── GPS ──
$('gpsBtn').onclick=()=>{
  if(!navigator.geolocation){toast('GPS tidak didukung');return;}
  $('gpsTxt').textContent='Mencari lokasi…';$('gpsTxt').className='gps';
  navigator.geolocation.getCurrentPosition(p=>{
    S.gps={lat:+p.coords.latitude.toFixed(6),lng:+p.coords.longitude.toFixed(6),acc:Math.round(p.coords.accuracy),at:new Date().toISOString()};
    $('gpsTxt').innerHTML=`✅ ${S.gps.lat}, ${S.gps.lng} (±${S.gps.acc}m) · <a href="https://maps.google.com/?q=${S.gps.lat},${S.gps.lng}" target="_blank">Maps</a>`;
    $('gpsTxt').className='gps ok';
  },err=>{$('gpsTxt').textContent='Gagal ambil lokasi: '+err.message;},{enableHighAccuracy:true,timeout:20000,maximumAge:0});
};

// ── photos ──
let photoKey=null;
async function compress(file){
  const url=await new Promise(r=>{const rd=new FileReader();rd.onload=()=>r(rd.result);rd.readAsDataURL(file);});
  const img=new Image();await new Promise((r,j)=>{img.onload=r;img.onerror=j;img.src=url;});
  const MAX=800;let w=img.width,h=img.height;
  if(w>MAX||h>MAX){if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;}}
  const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);
  return c.toDataURL('image/jpeg',0.6);
}
document.querySelectorAll('.phbox').forEach(b=>b.onclick=e=>{
  const k=b.dataset.k;
  if(e.target.classList.contains('x')){S.photos[k]=null;b.style.backgroundImage='';b.classList.remove('has');return;}
  photoKey=k;$('file').value='';$('file').click();
});
$('file').onchange=async()=>{
  const f=$('file').files[0];if(!f||!photoKey)return;
  try{const d=await compress(f);S.photos[photoKey]=d;const b=document.querySelector(`.phbox[data-k="${photoKey}"]`);b.style.backgroundImage=`url(${d})`;b.classList.add('has');}
  catch(e){toast('Foto gagal dibaca');}
};

// ── save ──
function collect(){
  return {
    mds:$('mds').value.trim(),
    activity:S.activity,channel:S.channel,
    outlet:$('outlet').value.trim(),address:$('address').value.trim(),gps:S.gps,
    pic:$('pic').value.trim(),picRole:$('picRole').value.trim(),picPhone:$('picPhone').value.trim(),
    items:window.ITEMS.filter(p=>S.items[p.name]).map(p=>{const v=S.items[p.name];
      return {name:p.name,code:p.code,cat:p.cat,available:!!v.av,order:v.ord?Number(v.ord):0};}),
    photoDisplay:S.photos.display,photoComp:S.photos.comp,
    notes:$('notes').value.trim(),
    date:$('vdate').value,
  };
}
function validate(d){
  if(!d.mds)return 'Isi Nama MDS';
  if(!d.date)return 'Isi Tanggal Visit';
  if(!d.activity)return 'Pilih Aktivitas';
  if(!d.channel)return 'Pilih Channel';
  if(!d.outlet)return 'Isi Nama Outlet';
  if(!d.gps)return 'Check-in GPS dulu';
  if(!d.photoDisplay)return 'Foto Display wajib';
  return null;
}
function waText(d){
  const avail=d.items.filter(i=>i.available),ord=d.items.filter(i=>i.order>0);
  const lines=[
    '*VISIT SPECIAL CHANNEL*',
    `📅 Tanggal Visit: ${new Date(d.date+'T00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}`,
    `👤 MDS: ${d.mds}`,
    `🎯 Aktivitas: ${label(ACTIVITIES,d.activity)}`,
    `🏷️ Channel: ${label(CHANNELS,d.channel)}`,
    `🏪 Outlet: ${d.outlet}`,
    d.address?`📍 ${d.address}`:'',
    d.gps?`🗺️ https://maps.google.com/?q=${d.gps.lat},${d.gps.lng}`:'',
    `☎️ PIC: ${d.pic||'-'}${d.picRole?' - '+d.picRole:''}${d.picPhone?' ('+d.picPhone+')':''}`,
    '',
    `*✅ Produk tersedia (${avail.length}):*`,
    ...(avail.length?avail.map(i=>`• ${i.name}`):['-']),
    '',
    `*📦 Order (${ord.reduce((s,i)=>s+i.order,0)}):*`,
    ...(ord.length?ord.map(i=>`• ${i.name} — ${i.order}`):['-']),
    '',
    d.notes?`📝 ${d.notes}`:'',
  ];
  return lines.filter((l,i,a)=>l!==''||a[i-1]!=='').join('\n');
}
function resetForm(){
  ['outlet','address','pic','picRole','picPhone','notes','q'].forEach(id=>$(id).value='');$('vdate').value=today();
  S.activity=S.channel=S.gps=null;S.items={};S.photos={display:null,comp:null};
  document.querySelectorAll('.chip.on').forEach(c=>c.classList.remove('on'));
  document.querySelectorAll('.phbox').forEach(b=>{b.style.backgroundImage='';b.classList.remove('has');});
  $('gpsTxt').textContent='Belum check-in';$('gpsTxt').className='gps';
  renderProducts();window.scrollTo(0,0);
}
let lastSaved=null;
$('saveBtn').onclick=async()=>{
  const btn=$('saveBtn');
  if(lastSaved){window.open('https://wa.me/?text='+encodeURIComponent(waText(lastSaved)),'_blank');return;}
  const d=collect();const err=validate(d);if(err){toast(err);return;}
  if(!db){toast('Database tidak tersambung');return;}
  store.set('sc_mds',d.mds);
  btn.disabled=true;btn.textContent='Menyimpan…';
  try{
    // don't block on server ack when offline — persistence queues the write
    const p=db.collection(COLLECTION).add({...d,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    await Promise.race([p,new Promise(r=>setTimeout(r,8000))]);
    lastSaved=d;
    toast('✅ Visit tersimpan');
    btn.className='btn wa';btn.textContent='📤 Share ke WhatsApp';
    const done=document.createElement('button');done.className='btn ghost';done.style.marginTop='8px';done.textContent='Visit baru';
    done.onclick=()=>{lastSaved=null;btn.className='btn';btn.textContent='Simpan Visit';done.remove();resetForm();};
    btn.after(done);
  }catch(e){console.error(e);toast('Gagal simpan: '+(e.code||e.message));btn.textContent='Simpan Visit';}
  btn.disabled=false;
};

// ── history ──
let HIST=[],hFilter='all';
function renderFilter(){
  const all=[{k:'all',label:'Semua',icon:''},...CHANNELS];
  $('hFilter').innerHTML=all.map(o=>`<button class="chip${hFilter===o.k?' on':''}" data-k="${o.k}">${o.icon} ${esc(o.label)}</button>`).join('');
}
$('hFilter').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;hFilter=b.dataset.k;renderFilter();renderHist();};
function rows(){return HIST.filter(h=>hFilter==='all'||h.channel===hFilter);}
function renderHist(){
  const r=rows();$('hCount').textContent=`Riwayat (${r.length})`;
  $('hList').innerHTML=r.length?r.map(h=>`<div class="card h-item">
    <div class="t">${esc(h.outlet)}</div>
    <div class="m"><span class="tag">${esc(label(CHANNELS,h.channel))}</span><span class="tag">${esc(label(ACTIVITIES,h.activity))}</span></div>
    <div class="m">${esc(h.date)} · ${esc(h.mds)} · ${(h.items||[]).filter(i=>i.available).length} produk ada · order ${(h.items||[]).reduce((s,i)=>s+(i.order||0),0)}</div>
    ${h.notes?`<div class="m">📝 ${esc(h.notes)}</div>`:''}
  </div>`).join(''):'<div class="empty">Belum ada visit</div>';
}
let unsub=null;
function loadHist(){
  if(unsub||!db)return;renderFilter();
  unsub=db.collection(COLLECTION).orderBy('createdAt','desc').limit(300).onSnapshot(s=>{
    HIST=s.docs.map(d=>({id:d.id,...d.data()}));renderHist();
  },e=>{$('hList').innerHTML=`<div class="empty">Gagal memuat: ${esc(e.code||e.message)}</div>`;});
}
$('csvBtn').onclick=()=>{
  const r=rows();if(!r.length){toast('Tidak ada data');return;}
  const head=['Tanggal','MDS','Aktivitas','Channel','Outlet','Alamat','Lat','Lng','PIC','Jabatan PIC','HP PIC','Produk Tersedia','Order','Total Order','Catatan'];
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const lines=[head.map(q).join(',')].concat(r.map(h=>[h.date,h.mds,label(ACTIVITIES,h.activity),label(CHANNELS,h.channel),h.outlet,h.address,h.gps?.lat,h.gps?.lng,h.pic,h.picRole,h.picPhone,
    (h.items||[]).filter(i=>i.available).map(i=>i.name).join('; '),(h.items||[]).filter(i=>i.order>0).map(i=>i.name+' x'+i.order).join('; '),(h.items||[]).reduce((s,i)=>s+(i.order||0),0),h.notes].map(q).join(',')));
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+lines.join('\n')],{type:'text/csv'}));
  a.download=`special-channel-${new Date().toISOString().slice(0,10)}.csv`;a.click();
};

// ── tabs ──
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===t));
  const hist=t.dataset.tab==='hist';
  $('v-form').classList.toggle('hidden',hist);$('v-hist').classList.toggle('hidden',!hist);$('foot').classList.toggle('hidden',hist);
  if(hist)loadHist();
});
