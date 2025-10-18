// supervisor.js
document.addEventListener('DOMContentLoaded', async () => {
  if (!firebase || !auth) { alert('Add firebase-config.js'); return; }

  auth.onAuthStateChanged(async user => {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }

    const userEmail = user.email;
    document.getElementById('userInfo').textContent = userEmail;
    document.getElementById('supName').value = userEmail.split('@')[0]; // display only
    document.getElementById('supName').readOnly = true; // prevent mismatch
    document.getElementById('dateInput').value = new Date().toISOString().slice(0, 10);

    await loadActivities();
    setupPhotoGrid();
    await loadMySubmissions(); // load recent submissions on page load
  });

  document.getElementById('uploadBtn').addEventListener('click', uploadSubmission);
  document.getElementById('previewPpt').addEventListener('click', previewLocalPpt);
});

// Load activities into dropdown
async function loadActivities() {
  const sel = document.getElementById('activitySelect');
  sel.innerHTML = '';
  const snap = await db.collection('activities').orderBy('name').get();
  if (snap.empty) sel.innerHTML = '<option>No activities</option>';
  snap.forEach(doc => {
    const d = doc.data();
    const opt = document.createElement('option');
    opt.value = doc.id;
    opt.textContent = d.name;
    sel.appendChild(opt);
  });
}

// Photo grid setup
const photoSlots = [];

function setupPhotoGrid() {
  const grid = document.getElementById('photoGrid');
  grid.innerHTML = '';
  photoSlots.length = 0;

  for (let i = 0; i < 9; i++) {
    const box = document.createElement('div');
    box.className = 'photo-box';

    const head = document.createElement('div');
    head.textContent = 'Photo ' + (i + 1);

    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    thumb.textContent = 'No photo';

    const desc = document.createElement('input');
    desc.placeholder = 'Short description';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.addEventListener('change', async e => {
      const f = e.target.files[0];
      if (!f) return;
      thumb.textContent = 'Compressing...';
      try {
        let compressed = await imageCompression(f, { maxSizeMB: 0.3, maxWidthOrHeight: 1400, useWebWorker: true });
        if (compressed.size > 300 * 1024) {
          let q = 0.75;
          while (compressed.size > 300 * 1024 && q > 0.3) {
            compressed = await imageCompression(f, { maxSizeMB: 0.3, maxWidthOrHeight: 1400, initialQuality: q });
            q -= 0.1;
          }
        }
        const reader = new FileReader();
        reader.onload = () => {
          thumb.innerHTML = '';
          const im = document.createElement('img');
          im.src = reader.result;
          thumb.appendChild(im);
          photoSlots[i].data = reader.result;
        };
        reader.readAsDataURL(compressed);
      } catch (err) {
        console.error(err);
        thumb.textContent = 'Error';
      }
    });

    box.appendChild(head);
    box.appendChild(thumb);
    box.appendChild(desc);
    box.appendChild(input);
    grid.appendChild(box);
    photoSlots.push({ desc, input, thumb, data: null });
  }
}

// Convert DataURL to Blob
function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8 = new Uint8Array(n);
  while (n--) {
    u8[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8], { type: mime });
}

// Upload submission to Cloudinary + Firestore
async function uploadSubmission() {
  const activityId = document.getElementById('activitySelect').value;
  if (!activityId) return alert('Select activity');

  const date = document.getElementById('dateInput').value;
  const supName = auth.currentUser.email; // use logged-in email
  const notes = document.getElementById('notes').value || '';

  if (photoSlots.some(s => !s.data)) return alert('Attach all 9 photos');

  document.getElementById('status').textContent = 'Uploading...';

  try {
    const actDoc = await db.collection('activities').doc(activityId).get();
    const activityName = actDoc.exists ? actDoc.data().name : 'Activity';
    const subId = 'sub_' + Date.now().toString(36);

    const cloudName = 'dsonhgs2i';
    const uploadPreset = 'Carrier';
    const photosMeta = [];

    for (let i = 0; i < 9; i++) {
      const blob = dataURLtoBlob(photoSlots[i].data);
      const formData = new FormData();
      formData.append('file', blob);
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', `submissions/${date}/${subId}`);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      photosMeta.push({ desc: photoSlots[i].desc.value || '', url: data.secure_url });
    }

    const doc = {
      id: subId,
      activityId,
      activityName,
      supervisor: supName,
      date,
      notes,
      photos: photosMeta,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('submissions').doc(subId).set(doc);
    document.getElementById('status').textContent = '✅ Uploaded successfully!';
    setupPhotoGrid();
    await loadMySubmissions();
  } catch (err) {
    console.error(err);
    document.getElementById('status').textContent = '❌ Upload failed: ' + (err.message || err);
  }
}

// Load recent submissions for the logged-in supervisor
async function loadMySubmissions() {
  const supEmail = auth.currentUser.email;
  const q = await db.collection('submissions')
    .where('supervisor', '==', supEmail)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  const container = document.getElementById('mySubs');
  container.innerHTML = '';

  if (q.empty) {
    container.innerHTML = '<div class="small muted">No submissions yet</div>';
    return;
  }

  q.forEach(doc => {
    const d = doc.data();
    const el = document.createElement('div');
    el.className = 'sub-card';

    const photosHtml = (d.photos || []).map(p => `
      <div style="width:64px;height:48px;overflow:hidden;border-radius:6px">
        <img src="${p.url}" style="width:100%;height:100%;object-fit:cover">
      </div>
    `).join('');

    el.innerHTML = `
      <div style="flex:1">
        <strong>${d.activityName || 'Unknown Activity'}</strong>
        <div class="small muted">${d.date} • ${d.supervisor}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${photosHtml}</div>
    `;

    container.appendChild(el);
  });
}

// Preview local PPT
async function previewLocalPpt() {
  const activity = document.getElementById('activitySelect').selectedOptions[0].text;
  const rec = {
    activity,
    supervisor: auth.currentUser.email,
    notes: document.getElementById('notes').value,
    photos: photoSlots.map(s => ({ desc: s.desc.value, data: s.data })),
  };
  await generateMultiSlidePPT([rec], `preview_${activity}_${document.getElementById('dateInput').value}.pptx`);
}
