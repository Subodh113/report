// admin-bulk-upload.js
let selectedPhotos = [];

document.addEventListener('DOMContentLoaded', async () => {
  auth.onAuthStateChanged(async user => {
    if (!user) { window.location.href = 'index.html'; return; }
    if (!adminEmails.includes(user.email)) { alert('Not authorized'); window.location.href = 'index.html'; return; }

    document.getElementById('userInfo').textContent = user.email;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await auth.signOut();
      window.location.href = 'index.html';
    });

    document.getElementById('dateInput').value = new Date().toISOString().slice(0,10);
    await loadActivities();

    document.getElementById('photoInput').addEventListener('change', handlePhotoSelect);
    document.getElementById('uploadBtn').addEventListener('click', uploadSubmission);
    document.getElementById('previewPpt').addEventListener('click', previewLocalPpt);
  });
});

async function loadActivities() {
  const sel = document.getElementById('activitySelect');
  sel.innerHTML = '';
  const snap = await db.collection('activities').orderBy('name').get();
  if (snap.empty) sel.innerHTML = '<option>No activities found</option>';
  snap.forEach(doc => {
    const opt = document.createElement('option');
    opt.value = doc.id;
    opt.textContent = doc.data().name;
    sel.appendChild(opt);
  });
}

async function handlePhotoSelect(e) {
  const files = Array.from(e.target.files);
  if (files.length < 3 || files.length > 9) {
    alert('Please select between 3 and 9 photos.');
    e.target.value = '';
    return;
  }
  selectedPhotos = [];
  const grid = document.getElementById('previewGrid');
  grid.innerHTML = '';

  for (const file of files) {
    const box = document.createElement('div');
    box.className = 'photo-box';
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    thumb.textContent = 'Compressing...';
    const desc = document.createElement('input');
    desc.placeholder = 'Short description (optional)';
    box.appendChild(thumb);
    box.appendChild(desc);
    grid.appendChild(box);

    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.3, maxWidthOrHeight: 1400, useWebWorker: true });
      const dataUrl = await toBase64(compressed);
      const img = document.createElement('img');
      img.src = dataUrl;
      thumb.innerHTML = '';
      thumb.appendChild(img);
      selectedPhotos.push({ data: dataUrl, desc });
    } catch (err) {
      thumb.textContent = 'Error';
      console.error(err);
    }
  }
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]); let n = bstr.length;
  const u8 = new Uint8Array(n); while (n--) u8[n] = bstr.charCodeAt(n);
  return new Blob([u8], { type: mime });
}

async function uploadSubmission() {
  if (selectedPhotos.length < 3) return alert('Minimum 3 photos required');
  if (selectedPhotos.length > 9) return alert('Maximum 9 photos allowed');

  const activityId = document.getElementById('activitySelect').value;
  const date = document.getElementById('dateInput').value;
  const notes = document.getElementById('notes').value || '';
  if (!activityId || !date) return alert('Select activity and date');

  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Uploading...';

  try {
    const actDoc = await db.collection('activities').doc(activityId).get();
    const activityName = actDoc.exists ? actDoc.data().name : 'Activity';
    const subId = 'admin_' + Date.now().toString(36);
    const storageFolder = `submissions/${date}/${subId}/`;
    const photosMeta = [];

    for (let i = 0; i < selectedPhotos.length; i++) {
      const blob = dataURLtoBlob(selectedPhotos[i].data);
      const ref = storage.ref().child(storageFolder + `img_${i+1}.jpg`);
      const snap = await ref.put(blob, { contentType: 'image/jpeg' });
      const url = await snap.ref.getDownloadURL();
      photosMeta.push({ desc: selectedPhotos[i].desc.value || '', url });
    }

    const doc = {
      id: subId,
      activityId,
      activityName,
      supervisor: 'Admin Upload',
      date,
      notes,
      photos: photosMeta,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('submissions').doc(subId).set(doc);
    statusEl.textContent = 'Uploaded successfully!';
    document.getElementById('photoInput').value = '';
    document.getElementById('previewGrid').innerHTML = '';
    selectedPhotos = [];
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Upload failed: ' + err.message;
  }
}

async function previewLocalPpt() {
  if (!selectedPhotos.length) return alert('Select photos first');
  const activity = document.getElementById('activitySelect').options[document.getElementById('activitySelect').selectedIndex].text;
  const rec = {
    activity,
    supervisor: 'Admin Upload',
    notes: document.getElementById('notes').value,
    photos: selectedPhotos.map(s => ({ desc: s.desc.value, data: s.data }))
  };
  await generateMultiSlidePPT([rec], `preview_${activity}_${document.getElementById('dateInput').value}.pptx`);
}
