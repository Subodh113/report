// supervisor.js — Production-ready
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

    const userEmail = user.email;

    // Display supervisor info
    const supNameInput = document.getElementById('supName');
    supNameInput.value = userEmail.split('@')[0];
    supNameInput.readOnly = true;

    document.getElementById('userInfo').textContent = userEmail;
    document.getElementById('dateInput').value = new Date().toISOString().slice(0, 10);

    await loadActivities();
    setupPhotoGrid();
    await loadMySubmissions();
  });

  document.getElementById('uploadBtn').addEventListener('click', uploadSubmission);
  document.getElementById('previewPpt').addEventListener('click', previewLocalPpt);
});

// Load activities into dropdown
async function loadActivities() {
  const sel = document.getElementById('activitySelect');
  sel.innerHTML = '';

  const snapshot = await db.collection('activities').orderBy('name').get();
  if (snapshot.empty) {
    sel.innerHTML = '<option disabled>No activities</option>';
    return;
  }

  snapshot.forEach(doc => {
    const { name } = doc.data();
    const option = document.createElement('option');
    option.value = doc.id;
    option.textContent = name;
    sel.appendChild(option);
  });
}

// Photo grid setup (9 slots)
const photoSlots = [];

function setupPhotoGrid() {
  const grid = document.getElementById('photoGrid');
  grid.innerHTML = '';
  photoSlots.length = 0;

  for (let i = 0; i < 9; i++) {
    const box = document.createElement('div');
    box.className = 'photo-box';

    const header = document.createElement('div');
    header.textContent = `Photo ${i + 1}`;

    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    thumb.textContent = 'No photo';

    const desc = document.createElement('input');
    desc.placeholder = 'Short description';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;

      thumb.textContent = 'Compressing...';
      try {
        let compressed = await imageCompression(file, {
          maxSizeMB: 0.3,
          maxWidthOrHeight: 1400,
          useWebWorker: true
        });

        // Further compress if still too large
        if (compressed.size > 300 * 1024) {
          let quality = 0.75;
          while (compressed.size > 300 * 1024 && quality > 0.3) {
            compressed = await imageCompression(file, {
              maxSizeMB: 0.3,
              maxWidthOrHeight: 1400,
              initialQuality: quality
            });
            quality -= 0.1;
          }
        }

        const reader = new FileReader();
        reader.onload = () => {
          thumb.innerHTML = '';
          const img = document.createElement('img');
          img.src = reader.result;
          thumb.appendChild(img);
          photoSlots[i].data = reader.result;
        };
        reader.readAsDataURL(compressed);
      } catch (err) {
        console.error(err);
        thumb.textContent = 'Error';
      }
    });

    box.append(header, thumb, desc, input);
    grid.appendChild(box);
    photoSlots.push({ desc, input, thumb, data: null });
  }
}

// Convert DataURL to Blob for upload
function dataURLtoBlob(dataURL) {
  const [meta, base64] = dataURL.split(',');
  const mime = meta.match(/:(.*?);/)[1];
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: mime });
}

// Upload submission to Cloudinary + Firestore
async function uploadSubmission() {
  const activityId = document.getElementById('activitySelect').value;
  if (!activityId) return alert('Select activity');

  const date = document.getElementById('dateInput').value;
  const supervisor = auth.currentUser.email; // always use logged-in email
  const notes = document.getElementById('notes').value || '';

  if (photoSlots.some(slot => !slot.data)) return alert('Attach all 9 photos');

  document.getElementById('status').textContent = 'Uploading...';

  try {
    const activityDoc = await db.collection('activities').doc(activityId).get();
    const activityName = activityDoc.exists ? activityDoc.data().name : 'Activity';
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
        body: formData
      });
      const data = await res.json();
      photosMeta.push({ desc: photoSlots[i].desc.value || '', url: data.secure_url });
    }

    const docData = {
      id: subId,
      activityId,
      activityName,
      supervisor,
      date,
      notes,
      photos: photosMeta,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('submissions').doc(subId).set(docData);

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
  const supervisor = auth.currentUser.email;
  const q = await db.collection('submissions')
    .where('supervisor', '==', supervisor)
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
    const photosHtml = (d.photos || []).map(p => `
      <div style="width:64px;height:48px;overflow:hidden;border-radius:6px">
        <img src="${p.url}" style="width:100%;height:100%;object-fit:cover">
      </div>
    `).join('');

    const el = document.createElement('div');
    el.className = 'sub-card';
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

// Preview local PPT without uploading
async function previewLocalPpt() {
  const activity = document.getElementById('activitySelect').selectedOptions[0].text;
  const rec = {
    activity,
    supervisor: auth.currentUser.email,
    notes: document.getElementById('notes').value,
    photos: photoSlots.map(s => ({ desc: s.desc.value, data: s.data }))
  };
  await generateMultiSlidePPT([rec], `preview_${activity}_${document.getElementById('dateInput').value}.pptx`);
}
