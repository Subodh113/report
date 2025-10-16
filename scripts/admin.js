// admin.js
document.addEventListener('DOMContentLoaded', async ()=> {
  if (!firebase || !auth) { alert('Add firebase-config.js'); return; }
  auth.onAuthStateChanged(async u => {
    if (!u) { window.location.href='index.html'; return; }
    if (!adminEmails.includes(u.email)) { alert('Not an admin'); window.location.href='index.html'; return; }
    document.getElementById('userInfo').textContent = u.email;
    await loadActivities();
    document.getElementById('addActivity').addEventListener('click', addActivity);
    document.getElementById('refreshBtn').addEventListener('click', loadSubmissionsForDate);
    document.getElementById('downloadPptBtn').addEventListener('click', downloadPPTForDate);
  });
});

async function loadActivities(){
  const list=document.getElementById('activitiesList'); list.innerHTML=''; const sel=document.getElementById('activityFilter'); sel.innerHTML='<option value="all">All</option>';
  const q = await db.collection('activities').orderBy('name').get();
  q.forEach(doc=>{ const d=doc.data(); const item=document.createElement('div'); item.style.display='flex'; item.style.justifyContent='space-between'; item.style.alignItems='center'; item.style.padding='6px 0'; const left=document.createElement('div'); left.textContent=d.name; const del=document.createElement('button'); del.className='btn secondary'; del.textContent='Delete'; del.onclick=async ()=>{ if(confirm('Delete?')){ await db.collection('activities').doc(doc.id).delete(); loadActivities(); } }; item.appendChild(left); item.appendChild(del); list.appendChild(item); const opt=document.createElement('option'); opt.value=doc.id; opt.textContent=d.name; sel.appendChild(opt); });
}

async function addActivity(){ const name=document.getElementById('newActivity').value.trim(); if(!name) return alert('Enter name'); await db.collection('activities').add({name}); document.getElementById('newActivity').value=''; loadActivities(); }

async function loadSubmissionsForDate(){
  const date=document.getElementById('datePicker').value; if(!date) return alert('Choose date');
  const q = await db.collection('submissions').where('date','==',date).orderBy('activityName','asc').get();
  let subs = q.docs.map(d=>d.data());
  const activityFilter = document.getElementById('activityFilter').value;
  if(activityFilter !== 'all') subs = subs.filter(s=>s.activityId === activityFilter);
  renderSubmissions(subs);
}

function renderSubmissions(subs){
  const container=document.getElementById('subList'); container.innerHTML=''; if(!subs.length){ container.innerHTML='<div class="small muted">No submissions</div>'; return; }
  subs.forEach(s=>{ const card=document.createElement('div'); card.className='sub-card'; card.innerHTML=`<div style="flex:1"><strong>${s.activityName}</strong><div class="small muted">${s.date} • ${s.supervisor}</div></div><div style="display:flex;gap:8px">${s.photos.slice(0,6).map(p=>`<div style="width:64px;height:48px;overflow:hidden;border-radius:6px"><img src="${p.url}" style="width:100%;height:100%;object-fit:cover"></div>`).join('')}</div><div style="margin-left:auto;display:flex;gap:8px"><button class="btn" onclick='downloadSinglePPT("${s.id}")'>Download PPT</button></div>`; container.appendChild(card); });
}

async function downloadSinglePPT(subId){ const doc=await db.collection('submissions').doc(subId).get(); if(!doc.exists) return alert('Not found'); const d=doc.data(); const rec={activity: d.activityName, supervisor:d.supervisor, notes:d.notes||'', photos:d.photos}; await generateMultiSlidePPT([rec], `EHS_${d.activityName}_${d.date}.pptx`); }

async function downloadPPTForDate(){ const date=document.getElementById('datePicker').value; if(!date) return alert('Choose date'); const q = await db.collection('submissions').where('date','==',date).get(); const subs=q.docs.map(d=>d.data()); const byAct={}; subs.forEach(s=>{ if(!byAct[s.activityName]) byAct[s.activityName]={activity:s.activityName, supervisor:s.supervisor, notes:s.notes||'', photos:[]}; s.photos.forEach(p=>byAct[s.activityName].photos.push(p)); }); const records=Object.values(byAct).map(a=>({...a, photos: a.photos.slice(0,9)})); await generateMultiSlidePPT(records, `EHS_${date}.pptx`); }
