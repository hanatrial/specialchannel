// Visit Special Channel — standalone tool, shares the MDS Visit Firebase project.
const FIREBASE_CONFIG={apiKey:"AIzaSyCtYc8uZICLzQrA1b7l00Yo_9V_rqNVOu0",authDomain:"mds-visit.firebaseapp.com",projectId:"mds-visit",storageBucket:"mds-visit.firebasestorage.app",messagingSenderId:"732603054928",appId:"1:732603054928:web:9f946bfa13d56d860a8a55"};
const COLLECTION='special_channel_logs';
let db=null;
try{firebase.initializeApp(FIREBASE_CONFIG);db=firebase.firestore();db.enablePersistence({synchronizeTabs:true}).catch(()=>{});}catch(e){console.warn('Firebase init failed',e);}

const ACTIVITIES=[
  {k:'so',label:'Taking Sales Order to Distributor',icon:'🧾'},
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

$('mds').value=store.get('sc_mds')||'Agustianto Kombong';
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
  if(!d.activity)return 'Choose an Activity';
  if(!d.channel)return 'Pilih Channel';
  if(!d.outlet)return 'Isi Nama Outlet';
  if(!d.gps)return 'Check-in GPS dulu';
  if(!d.pic)return 'Isi Nama PIC';
  if(!d.picRole)return 'Isi Jabatan PIC';
  if(!d.picPhone)return 'Isi No. HP PIC';
  if(!d.photoDisplay)return 'Foto Display wajib';
  if(!d.photoComp)return 'Foto Kompetitor wajib';
  if(!d.notes)return 'Isi Catatan';
  return null;
}
function waText(d){
  const avail=d.items.filter(i=>i.available),ord=d.items.filter(i=>i.order>0);
  const lines=[
    '*MDS SPECIAL CHANNEL (MAKASSAR)*',
    `📅 Tanggal Visit: ${new Date(d.date+'T00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}`,
    `👤 MDS: ${d.mds}`,
    `🎯 Activity: ${label(ACTIVITIES,d.activity)}`,
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
  const head=['Tanggal','MDS','Activity','Channel','Outlet','Alamat','Lat','Lng','PIC','Jabatan PIC','HP PIC','Produk Tersedia','Order','Total Order','Catatan'];
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const lines=[head.map(q).join(',')].concat(r.map(h=>[h.date,h.mds,label(ACTIVITIES,h.activity),label(CHANNELS,h.channel),h.outlet,h.address,h.gps?.lat,h.gps?.lng,h.pic,h.picRole,h.picPhone,
    (h.items||[]).filter(i=>i.available).map(i=>i.name).join('; '),(h.items||[]).filter(i=>i.order>0).map(i=>i.name+' x'+i.order).join('; '),(h.items||[]).reduce((s,i)=>s+(i.order||0),0),h.notes].map(q).join(',')));
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+lines.join('\n')],{type:'text/csv'}));
  a.download=`special-channel-${new Date().toISOString().slice(0,10)}.csv`;a.click();
};

// ── monitoring (sales file: Sektor Market 60, list items only) ──
const rp=n=>'Rp'+Math.round(n).toLocaleString('id-ID');
const rpShort=n=>n>=1e6?'Rp'+(n/1e6).toLocaleString('id-ID',{maximumFractionDigits:2})+' jt':rp(n);
function sumBy(rows,key){
  const m=new Map();
  for(const r of rows){const k=key(r);const v=m.get(k)||{net:0,qty:0,n:0,rows:[]};v.net+=r.net;v.qty+=r.qty;v.n++;v.rows.push(r);m.set(k,v);}
  return [...m].sort((a,b)=>b[1].net-a[1].net);
}
function renderMon(){
  const M=MON||window.MONITORING;
  if(!M||!M.rows.length){$('mTx').innerHTML='<div class="empty">Belum ada data</div>';return;}
  const fmtD=s=>new Date(s+'T00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
  $('mPeriod').textContent=`Sektor 60 · ${fmtD(M.from)} – ${fmtD(M.to)}`;
  const rows=M.rows;
  const net=rows.reduce((s,r)=>s+r.net,0);
  const outlets=new Set(rows.map(r=>r.outlet)).size;
  $('mKpi').innerHTML=[[rpShort(net),'Netto'],[outlets,'Outlet'],[new Set(rows.map(r=>r.code)).size,'Item terjual']]
    .map(([v,k])=>`<div class="kpi"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('');
  const cat=code=>(window.ITEMS.find(p=>p.code===code)||{}).cat||'';
  $('mItems').innerHTML=`<div class="tr" style="font-size:11px;font-weight:800;color:var(--t3)"><span class="nm">ITEM</span><span class="q">PCS</span><span class="r">NETTO</span></div>`+
    sumBy(rows,r=>r.code).map(([code,v])=>`<div class="tr"><span class="nm">${esc(v.rows[0].item)}<small>${esc(cat(code))}</small></span><span class="q">${v.qty.toLocaleString('id-ID')}</span><span class="r">${rp(v.net)}</span></div>`).join('');
  const dShort=s=>new Date(s+'T00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short'});
  $('mOutlets').innerHTML=`<div class="tr" style="font-size:11px;font-weight:800;color:var(--t3)"><span class="nm">OUTLET</span><span class="q">TRX</span><span class="r">NOMINAL</span></div>`+
    sumBy(rows,r=>r.outlet).map(([o,v])=>{const inv=new Set(v.rows.map(r=>r.inv)).size;const dates=[...new Set(v.rows.map(r=>r.d))].sort().map(dShort).join(', ');
    return `<div class="tr"><span class="nm">${esc(o)}<small>${dates}</small></span><span class="q">${inv}</span><span class="r">${rp(v.net)}</span></div>`}).join('');
  // one transaction = one invoice
  const tx=sumBy(rows,r=>r.inv).map(([inv,v])=>({inv,...v,outlet:v.rows[0].outlet,type:v.rows[0].type,d:v.rows[0].d})).sort((a,b)=>b.d.localeCompare(a.d)||b.net-a.net);
  $('mTxCount').textContent=`Transaksi (${tx.length})`;
  $('mTx').innerHTML=tx.map(t=>`<div class="card h-item">
    <div style="display:flex;justify-content:space-between;gap:10px"><div class="t" style="font-size:15px">${esc(t.outlet)}</div><div class="t" style="font-size:15px;white-space:nowrap">${rp(t.net)}</div></div>
    <div class="m">${fmtD(t.d)} · ${t.n} item</div>
    ${t.rows.map(r=>`<div class="m">• ${esc(r.item)} — ${r.qty} pcs · ${rp(r.net)}</div>`).join('')}
  </div>`).join('');
  showUpStatus();
  $('mNote').textContent=`Sumber: ${M.source}. Hanya Sektor Market 60 (SPEC. OUTLET RETAIL) dan item yang ada di list item (dicocokkan lewat kode barang). Netto = setelah diskon.`;
}

// ── monitoring upload: read sales Excel in the browser, keep Sektor 60 + list items, share via Firestore ──
let MON=null; // latest uploaded data from Firestore (falls back to monitoring-data.js)
const MON_DOC=()=>db.collection('special_channel_monitoring').doc('latest');
function loadScript(src){return new Promise((ok,no)=>{if(document.querySelector(`script[src="${src}"]`))return ok();const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error('Gagal memuat '+src));document.head.appendChild(s);});}
const LIB_ZIP='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const LIB_XLSX='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const NEED=['Sektor Market','Kode Barang Principal','Nama Barang','Nama Customer','Nomor Faktur','Tgl Faktur','Qty Kecil','Netto'];

function normDate(v){
  if(v==null||v==='')return '';
  if(typeof v==='number'||/^\d+(\.\d+)?$/.test(v)){const d=new Date(Math.round((+v-25569)*864e5));return d.toISOString().slice(0,10);} // Excel serial
  const s=String(v);const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return m[0];
  const m2=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);if(m2)return `${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
  return s.slice(0,10);
}
// A pivot-only workbook still carries every raw row in its pivot cache — rebuild them from there.
async function rowsFromPivotCache(buf){
  await loadScript(LIB_ZIP);
  const zip=await JSZip.loadAsync(buf);
  const defs=Object.keys(zip.files).filter(f=>/^xl\/pivotCache\/pivotCacheDefinition\d+\.xml$/.test(f));
  const P=new DOMParser();
  for(const defPath of defs){
    const recPath=defPath.replace('Definition','Records');if(!zip.files[recPath])continue;
    const def=P.parseFromString(await zip.file(defPath).async('string'),'application/xml');
    const fields=[...def.getElementsByTagName('cacheField')];
    const names=fields.map(f=>f.getAttribute('name'));
    if(!NEED.every(n=>names.includes(n)))continue;
    const shared=fields.map(f=>{const si=f.getElementsByTagName('sharedItems')[0];return si?[...si.children].map(c=>c.getAttribute('v')):[];});
    const rec=P.parseFromString(await zip.file(recPath).async('string'),'application/xml');
    const out=[];
    for(const r of rec.getElementsByTagName('r')){
      const o={};let i=0;
      for(const c of r.children){const n=names[i];o[n]=c.localName==='x'?shared[i][+c.getAttribute('v')]:c.localName==='m'?'':c.getAttribute('v');i++;}
      out.push(o);
    }
    return out;
  }
  return null;
}
// Plain export: find the sheet/row holding the headers.
async function rowsFromSheets(buf){
  await loadScript(LIB_XLSX);
  const wb=XLSX.read(buf,{type:'array',cellDates:false});
  for(const name of wb.SheetNames){
    const aoa=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:''});
    const h=aoa.findIndex(r=>NEED.every(n=>r.includes(n)));
    if(h<0)continue;
    const head=aoa[h];
    return aoa.slice(h+1).map(r=>Object.fromEntries(head.map((k,i)=>[k,r[i]])));
  }
  return null;
}
function pickMonitoring(raw,source){
  const codes=new Set(window.ITEMS.map(p=>p.code));
  const strip=s=>String(s??'').replace(/^\S+\s+\((.*)\)$/,'$1').trim();
  const rows=raw.filter(r=>/^60\b/.test(String(r['Sektor Market']).trim())&&codes.has(String(r['Kode Barang Principal']).trim()))
    .map(r=>({d:normDate(r['Tgl Faktur']),inv:String(r['Nomor Faktur']),outlet:String(r['Nama Customer']).trim(),kec:strip(r['Kecamatan']),
      code:String(r['Kode Barang Principal']).trim(),item:String(r['Nama Barang']).trim(),qty:Number(r['Qty Kecil'])||0,net:Math.round(Number(r['Netto'])||0)}));
  const dates=raw.map(r=>normDate(r['Tgl Faktur'])).filter(Boolean).sort();
  return {source,from:dates[0]||'',to:dates[dates.length-1]||'',totalRows:raw.length,rows};
}
function showUpStatus(){
  const M=MON||window.MONITORING;if(!M)return;
  const at=M.uploadedAt?.toDate?M.uploadedAt.toDate():null;
  $('upStatus').innerHTML=`Data sekarang: <b>${esc(M.source)}</b>${at?' · diupload '+at.toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''}`;
  $('upStatus').className='gps';
}
$('upBtn').onclick=()=>{$('upFile').value='';$('upFile').click();};
$('upFile').onchange=async()=>{
  const f=$('upFile').files[0];if(!f)return;
  const st=$('upStatus');st.className='gps';st.textContent='Membaca file…';$('upBtn').disabled=true;
  try{
    const buf=await f.arrayBuffer();
    let raw=null;
    if(/\.xls[xm]$/i.test(f.name))raw=await rowsFromPivotCache(buf);
    if(!raw)raw=await rowsFromSheets(buf);
    if(!raw)throw new Error('Kolom tidak ditemukan. File harus punya kolom: '+NEED.join(', '));
    const M=pickMonitoring(raw,f.name);
    if(!M.rows.length)throw new Error(`File terbaca (${raw.length} baris), tapi tidak ada transaksi Sektor 60 dengan item dari list.`);
    if(!db)throw new Error('Database tidak tersambung');
    st.textContent='Menyimpan…';
    const p=MON_DOC().set({...M,uploadedAt:firebase.firestore.FieldValue.serverTimestamp()});
    await Promise.race([p,new Promise(r=>setTimeout(r,8000))]);
    MON={...M,uploadedAt:{toDate:()=>new Date()}};
    renderMon();
    toast(`✅ ${M.rows.length} transaksi Sektor 60 dimuat`);
  }catch(e){console.error(e);st.textContent='❌ '+(e.message||e);st.className='gps';st.style.color='var(--danger)';$('upBtn').disabled=false;return;}
  st.style.color='';$('upBtn').disabled=false;
};
let monSub=null;
function loadMon(){
  renderMon();
  if(monSub||!db)return;
  monSub=MON_DOC().onSnapshot(s=>{if(s.exists){MON=s.data();renderMon();}},e=>console.warn('monitoring load',e));
}

// ── list outlet (guidebook) ──
const OUTLETS=window.OUTLETS||[];
const O={cat:'all',kec:'all'};
const mapUrl=o=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(/makassar/i.test(o.n)?o.n:o.n+' Makassar');
const catGroup=c=>/Padel/.test(c)?'Padel':/Mahjong/.test(c)?'Mahjong':/Board/.test(c)?'Board Game':/Steak/.test(c)?'Steak House':/Gym/.test(c)?'Gym':/Sport/.test(c)?'Sport Center':/Cafe|Warkop/.test(c)?'Cafe':'Resto';
function oChips(el,vals,key){
  el.innerHTML=['all',...vals].map(v=>`<button class="chip${O[key]===v?' on':''}" data-v="${esc(v)}">${v==='all'?'Semua':esc(v)}</button>`).join('');
  el.onclick=e=>{const b=e.target.closest('.chip');if(!b)return;O[key]=b.dataset.v;renderOutlets();};
}
function renderOutlets(){
  const cnt=a=>[...new Set(a)].sort();
  oChips($('oCat'),['Cafe','Resto','Steak House','Padel','Gym','Sport Center','Mahjong','Board Game'].filter(g=>OUTLETS.some(o=>catGroup(o.cat)===g)),'cat');
  oChips($('oKec'),cnt(OUTLETS.map(o=>o.kec).filter(Boolean)),'kec');
  const q=$('oq').value.trim().toLowerCase();
  const list=OUTLETS.filter(o=>(O.cat==='all'||catGroup(o.cat)===O.cat)&&(O.kec==='all'||o.kec===O.kec)&&(!q||(o.n+' '+o.addr).toLowerCase().includes(q)))
    .sort((a,b)=>(+b.rv||0)-(+a.rv||0));
  $('oCount').textContent=`${list.length} outlet`;
  $('oList').innerHTML=list.length?`<div class="card o-tbl"><div class="o-row o-head"><span class="o-nm">Outlet</span><span class="o-rt">⭐</span><span class="o-b">Maps</span><span class="o-b">Visit</span></div>`+list.map(o=>`<div class="o-row">
    <span class="o-nm"><b>${esc(o.n)}</b><small>${esc(o.cat)}${o.kec?' · '+esc(o.kec):''}</small></span>
    <span class="o-rt">${o.rt?esc(o.rt)+'<small>'+(+o.rv).toLocaleString('id-ID')+'</small>':'–'}</span>
    <a class="o-b" href="${mapUrl(o)}" target="_blank" rel="noopener" title="Buka Maps">🗺️</a>
    <button class="o-b dark" data-visit="${OUTLETS.indexOf(o)}" title="Visit">✍️</button>
  </div>`).join('')+'</div>':'<div class="empty">Tidak ada outlet</div>';
}
$('oq').oninput=renderOutlets;
$('oList').onclick=e=>{const b=e.target.closest('[data-visit]');if(!b)return;const o=OUTLETS[+b.dataset.visit];
  $('outlet').value=o.n;$('address').value=o.addr||'';
  const ch=[...$('channel').children].find(c=>c.dataset.k===o.ch);if(ch&&S.channel!==o.ch)ch.click();
  document.querySelector('.tab[data-tab="form"]').click();window.scrollTo(0,0);toast('Outlet terisi, lanjut isi form visit');};

// ── tabs ──
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===t));
  const tab=t.dataset.tab;
  ['form','hist','list','mon'].forEach(v=>$('v-'+v).classList.toggle('hidden',tab!==v));
  $('foot').classList.toggle('hidden',tab!=='form');
  if(tab==='hist')loadHist();
  if(tab==='list')renderOutlets();
  window.scrollTo(0,0);
  if(tab==='mon')loadMon();
});
