// admin.js — EHS Cleaning Admin Dashboard (Stable Version)
// Author: Senior Developer Optimized Code (2025)

document.addEventListener('DOMContentLoaded', () => {
  if (!firebase || !auth) {
    alert('Firebase not configured — check firebase-config.js');
    return;
  }

  auth.onAuthStateChanged(async (u) => {
    if (!u) {
      window.location.href = 'index.html';
      return;
    }

    if (!adminEmails.includes(u.email)) {
      alert('Access denied — not an admin');
      window.location.href = 'index.html';
      return;
    }

    document.getElementById('userInfo').textContent = u.email;

    await loadActivities();

    document.getElementById('addActivity').addEventListener('click', addActivity);
    document.getElementById('refreshBtn').addEventListener('click', loadSubmissionsForDate);
    document.getElementById('downloadPptBtn').addEventListener('click', downloadPPTForDate);
  });
});

// -------------------------- Activity Management --------------------------
async function loadActivities() {
  const list = document.getElementById('activitiesList');
  const sel = document.getElementById('activityFilter');
  list.innerHTML = '';
  sel.innerHTML = '<option value="all">All</option>';

  const q = await db.collection('activities').orderBy('name').get();

  q.forEach((doc) => {
    const d = doc.data();
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
      if (confirm(`Delete activity "${d.name}"?`)) {
        await db.collection('activities').doc(doc.id).delete();
        loadActivities();
      }
    };

    item.appendChild(left);
    item.appendChild(del);
    list.appendChild(item);

    const opt = document.createElement('option');
    opt.value = doc.id;
    opt.textContent = d.name;
    sel.appendChild(opt);
  });
}

async function addActivity() {
  const name = document.getElementById('newActivity').value.trim();
  if (!name) return alert('Enter an activity name');
  await db.collection('activities').add({ name });
  document.getElementById('newActivity').value = '';
  loadActivities();
}

// -------------------------- Submissions --------------------------
async function loadSubmissionsForDate() {
  const date = document.getElementById('datePicker').value;
  if (!date) return alert('Select a date');

  document.getElementById('adminStatus').textContent = 'Loading...';

  const q = await db.collection('submissions').where('date', '==', date).get();
  let subs = q.docs.map((d) => ({ id: d.id, ...d.data() }));

  const activityFilter = document.getElementById('activityFilter').value;
  if (activityFilter !== 'all') {
    subs = subs.filter((s) => s.activityId === activityFilter);
  }

  console.log('Submissions loaded for date:', date, subs);
  renderSubmissions(subs);
  document.getElementById('adminStatus').textContent = `${subs.length} submission(s) loaded`;
}

function renderSubmissions(subs) {
  const container = document.getElementById('subList');
  container.innerHTML = '';

  if (!subs.length) {
    container.innerHTML = '<div class="small muted">No submissions found for this date.</div>';
    return;
  }

  subs.forEach((s) => {
    const card = document.createElement('div');
    card.className = 'sub-card';
    card.innerHTML = `
      <div style="flex:1">
        <strong>${s.activityName}</strong>
        <div class="small muted">${s.date} • ${s.supervisor}</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${s.photos
          .slice(0, 9)
          .map(
            (p) => `<img src="${p.url}" width="64" height="48" style="object-fit:cover;">`
          )
          .join('')}
      </div>
      <div style="margin-left:auto">
        <button class="btn small" onclick='downloadSinglePPT("${s.id}")'>Download PPT</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// -------------------------- PPT Export --------------------------
async function downloadSinglePPT(subId) {
  const docSnap = await db.collection('submissions').doc(subId).get();
  if (!docSnap.exists) return alert('Submission not found');

  const d = docSnap.data();
  const record = {
    activity: d.activityName,
    supervisor: d.supervisor,
    notes: d.notes || '',
    photos: d.photos,
  };

  await generateMultiSlidePPT([record], `EHS_${d.activityName}_${d.date}.pptx`);
}

async function downloadPPTForDate() {
  const date = document.getElementById('datePicker').value;
  if (!date) return alert('Select a date first');

  const q = await db.collection('submissions').where('date', '==', date).get();
  const subs = q.docs.map((d) => d.data());

  if (!subs.length) return alert('No submissions for this date');

  const grouped = {};
  subs.forEach((s) => {
    if (!grouped[s.activityName])
      grouped[s.activityName] = {
        activity: s.activityName,
        supervisor: s.supervisor,
        notes: s.notes || '',
        photos: [],
      };
    s.photos.forEach((p) => grouped[s.activityName].photos.push(p));
  });

  const records = Object.values(grouped).map((a) => ({
    ...a,
    photos: a.photos.slice(0, 9),
  }));

  await generateMultiSlidePPT(records, `EHS_${date}.pptx`);
}
