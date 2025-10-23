document.addEventListener('DOMContentLoaded', () => {
  if (!firebase || !auth) { alert('Firebase not configured'); return; }

  auth.onAuthStateChanged(async user => {
    if (!user) { window.location.href = 'index.html'; return; }
    document.getElementById('userInfo').textContent = user.email;

    await loadActivities();

    // Event listeners
    document.getElementById('addActivity').addEventListener('click', addActivity);
    document.getElementById('refreshBtn').addEventListener('click', loadSubmissionsForRange);
    document.getElementById('downloadPptBtn').addEventListener('click', downloadPPTForRange);

    // Toggle Existing Activities
    const toggleBtn = document.getElementById('toggleActivities');
    const existingContainer = document.getElementById('existingActivitiesContainer');
    let isVisible = true;
    toggleBtn.addEventListener('click', () => {
      isVisible = !isVisible;
      existingContainer.style.display = isVisible ? 'block' : 'none';
      toggleBtn.textContent = isVisible ? 'Hide Activities' : 'Show Activities';
    });

    // Reload activities when department filter changes
    document.getElementById('departmentFilter').addEventListener('change', () => loadActivities());
  });
});

// ---------------------- Activity Management ----------------------
async function loadActivities() {
  const list = document.getElementById('activitiesList');
  const sel = document.getElementById('activityFilter');
  const deptFilter = document.getElementById('departmentFilter').value;

  list.innerHTML = '';
  sel.innerHTML = '<option value="all">All</option>';

  const snapshot = await db.collection('activities').orderBy('name').get();

  snapshot.forEach(doc => {
    const d = doc.data();

    // Activity dropdown for filtering submissions
    if (deptFilter === 'all' || d.department === deptFilter) {
      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = d.name;
      sel.appendChild(opt);
    }

    // Existing Activities list
    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    const left = document.createElement('div');
    left.textContent = `[${d.department}] ${d.name}`;
    const del = document.createElement('button');
    del.className = 'btn secondary';
    del.textContent = 'Delete';
    del.onclick = async () => {
      if (confirm(`Delete "${d.name}"?`)) {
        await db.collection('activities').doc(doc.id).delete();
        loadActivities();
      }
    };
    item.appendChild(left);
    item.appendChild(del);
    list.appendChild(item);
  });
}

async function addActivity() {
  const name = document.getElementById('newActivity').value.trim();
  const dept = document.getElementById('deptSelect').value;
  if (!name || !dept) return alert('Enter activity name and select department');

  await db.collection('activities').add({ name, department: dept });
  document.getElementById('newActivity').value = '';
  loadActivities();
}

// ---------------------- Submissions ----------------------
async function loadSubmissionsForRange() {
  const start = document.getElementById('startDate').value;
  const end = document.getElementById('endDate').value;
  if (!start || !end) return alert('Select start and end dates');

  const dept = document.getElementById('departmentFilter').value;
  const actFilter = document.getElementById('activityFilter').value;

  document.getElementById('adminStatus').textContent = 'Loading...';

  // Firestore query only for date range
  const snapshot = await db.collection('submissions')
                           .where('date', '>=', start)
                           .where('date', '<=', end)
                           .get();

  let subs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  // Client-side filtering for department & activity
  if (dept !== 'all') subs = subs.filter(s => s.department === dept);
  if (actFilter !== 'all') subs = subs.filter(s => s.activityId === actFilter);

  renderSubmissions(subs);
  document.getElementById('adminStatus').textContent = `${subs.length} submission(s) loaded`;
}

function renderSubmissions(subs) {
  const container = document.getElementById('subList');
  container.innerHTML = '';
  if (!subs.length) {
    container.innerHTML = '<div class="small muted">No submissions found.</div>';
    return;
  }

  subs.forEach(s => {
    const card = document.createElement('div');
    card.className = 'sub-card';
    card.innerHTML = `
      <div style="flex:1">
        <strong>${s.activityName}</strong>
        <div class="small muted">${s.date} • ${s.supervisor} • [${s.department}]</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${s.photos.slice(0,9).map(p => `<img src="${p.url}" width="64" height="48">`).join('')}
      </div>
      <div style="margin-left:auto">
        <button class="btn small" onclick='downloadSinglePPT("${s.id}")'>Download PPT</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// ---------------------- Single PPT ----------------------
async function downloadSinglePPT(subId) {
  const docSnap = await db.collection('submissions').doc(subId).get();
  if (!docSnap.exists) return alert('Submission not found');

  const d = docSnap.data();
  const record = {
    activity: d.activityName,
    supervisor: d.supervisor,
    notes: d.notes || '',
    photos: d.photos
  };
  await generateMultiSlidePPT([record], `EHS_${d.activityName}_${d.date}.pptx`);
}

// ---------------------- Date Range PPT ----------------------
async function downloadPPTForRange() {
  const start = document.getElementById('startDate').value;
  const end = document.getElementById('endDate').value;
  if (!start || !end) return alert('Select start and end dates');

  const dept = document.getElementById('departmentFilter').value;
  const actFilter = document.getElementById('activityFilter').value;

  const snapshot = await db.collection('submissions')
                           .where('date', '>=', start)
                           .where('date', '<=', end)
                           .get();

  let subs = snapshot.docs.map(d => d.data());
  if (dept !== 'all') subs = subs.filter(s => s.department === dept);
  if (actFilter !== 'all') subs = subs.filter(s => s.activityId === actFilter);

  if (!subs.length) return alert('No submissions for selected range');

  const grouped = {};
  subs.forEach(s => {
    if (!grouped[s.activityName])
      grouped[s.activityName] = { activity: s.activityName, supervisor: s.supervisor, notes: s.notes || '', photos: [] };
    s.photos.forEach(p => grouped[s.activityName].photos.push(p));
  });

  const records = Object.values(grouped).map(a => ({ ...a, photos: a.photos.slice(0, 9) }));
  await generateMultiSlidePPT(records, `EHS_${start}_to_${end}.pptx`);
}
