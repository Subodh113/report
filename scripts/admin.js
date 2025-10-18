// admin.js
document.addEventListener('DOMContentLoaded', async () => {
  if (!firebase || !auth) { 
    alert('Add firebase-config.js'); 
    return; 
  }

  auth.onAuthStateChanged(async user => {
    if (!user) { 
      window.location.href = 'index.html'; 
      return; 
    }
    if (!adminEmails.includes(user.email)) { 
      alert('Not an admin'); 
      window.location.href = 'index.html'; 
      return; 
    }

    document.getElementById('userInfo').textContent = user.email;

    await loadActivities();

    document.getElementById('addActivity').addEventListener('click', addActivity);
    document.getElementById('refreshBtn').addEventListener('click', loadSubmissionsForDate);
    document.getElementById('downloadPptBtn').addEventListener('click', downloadPPTForDate);
  });
});

// Load activities and populate filter & list
async function loadActivities() {
  const list = document.getElementById('activitiesList');
  const sel = document.getElementById('activityFilter');
  list.innerHTML = '';
  sel.innerHTML = '<option value="all">All</option>';

  const snap = await db.collection('activities').orderBy('name').get();

  snap.forEach(doc => {
    const d = doc.data();

    // List of activities with delete button
    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.padding = '6px 0';
    const left = document.createElement('div');
    left.textContent = d.name;

    const del = document.createElement('button');
    del.className = 'btn secondary';
    del.textContent = 'Delete';
    del.onclick = async () => {
      if (confirm('Delete?')) {
        await db.collection('activities').doc(doc.id).delete();
        loadActivities();
      }
    };

    item.appendChild(left);
    item.appendChild(del);
    list.appendChild(item);

    // Add to filter dropdown
    const opt = document.createElement('option');
    opt.value = doc.id;
    opt.textContent = d.name;
    sel.appendChild(opt);
  });

  console.log("Activity filter options:", Array.from(sel.options).map(o => ({value: o.value, text: o.textContent})));
}

// Add new activity
async function addActivity() {
  const name = document.getElementById('newActivity').value.trim();
  if (!name) return alert('Enter name');
  await db.collection('activities').add({ name });
  document.getElementById('newActivity').value = '';
  loadActivities();
}

// Load submissions for selected date and activity filter
async function loadSubmissionsForDate() {
  const date = document.getElementById('datePicker').value;
  if (!date) return alert('Choose date');

  let snap = await db.collection('submissions')
                     .where('date', '==', date)
                     .orderBy('activityName', 'asc')
                     .get();

  let subs = snap.docs.map(d => d.data());

  const activityFilter = document.getElementById('activityFilter').value;
  if (activityFilter !== 'all') {
    subs = subs.filter(s => s.activityId === activityFilter);
  }

  console.log("Loaded submissions:", subs.map(s => ({
    id: s.id,
    activityId: s.activityId,
    activityName: s.activityName,
    photos: s.photos?.length
  })));

  renderSubmissions(subs);
}

// Render submissions safely
function renderSubmissions(subs) {
  const container = document.getElementById('subList');
  container.innerHTML = '';

  if (!subs.length) {
    container.innerHTML = '<div class="small muted">No submissions</div>';
    return;
  }

  subs.forEach(s => {
    const card = document.createElement('div');
    card.className = 'sub-card';

    const photosHtml = (s.photos || []).slice(0,6)
      .map(p => `
        <div style="width:64px;height:48px;overflow:hidden;border-radius:6px">
          <img src="${p.url}" style="width:100%;height:100%;object-fit:cover">
        </div>`).join('');

    card.innerHTML = `
      <div style="flex:1">
        <strong>${s.activityName || 'Unknown Activity'}</strong>
        <div class="small muted">${s.date} • ${s.supervisor}</div>
      </div>
      <div style="display:flex;gap:8px">${photosHtml}</div>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="btn" onclick='downloadSinglePPT("${s.id}")'>Download PPT</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// Download single submission PPT
async function downloadSinglePPT(subId) {
  const doc = await db.collection('submissions').doc(subId).get();
  if (!doc.exists) return alert('Not found');
  const d = doc.data();
  const rec = { activity: d.activityName, supervisor: d.supervisor, notes: d.notes || '', photos: d.photos };
  await generateMultiSlidePPT([rec], `EHS_${d.activityName}_${d.date}.pptx`);
}

// Download all submissions PPT for a date
async function downloadPPTForDate() {
  const date = document.getElementById('datePicker').value;
  if (!date) return alert('Choose date');

  const snap = await db.collection('submissions').where('date', '==', date).get();
  const subs = snap.docs.map(d => d.data());

  const byAct = {};
  subs.forEach(s => {
    if (!byAct[s.activityName]) {
      byAct[s.activityName] = { activity: s.activityName, supervisor: s.supervisor, notes: s.notes || '', photos: [] };
    }
    s.photos?.forEach(p => byAct[s.activityName].photos.push(p));
  });

  const records = Object.values(byAct).map(a => ({ ...a, photos: a.photos.slice(0,9) }));
  await generateMultiSlidePPT(records, `EHS_${date}.pptx`);
}
