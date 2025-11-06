document.addEventListener('DOMContentLoaded', async () => {
  if (!firebase || !auth) { alert('Firebase not configured'); return; }

  const userInfo = document.getElementById('userInfo');
  const photoInput = document.getElementById('photoInput');
  const photoPreview = document.getElementById('photoPreview');
  let selectedPhotos = [];

  // Load activities
  const activitySelect = document.getElementById('activitySelect');
  const activitySnapshot = await db.collection('activities').orderBy('name').get();
  activitySelect.innerHTML = '';
  activitySnapshot.forEach(doc => {
    const d = doc.data();
    const opt = document.createElement('option');
    opt.value = doc.id;
    opt.textContent = `[${d.department}] ${d.name}`;
    activitySelect.appendChild(opt);
  });

  // Auth
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    userInfo.textContent = user.email;
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await auth.signOut();
    window.location.href = 'index.html';
  });

  // Photo preview
  photoInput.addEventListener('change', (e) => {
    selectedPhotos = Array.from(e.target.files);
    if (selectedPhotos.length < 3 || selectedPhotos.length > 9) {
      alert('Please select between 3 and 9 photos.');
      photoInput.value = '';
      photoPreview.innerHTML = '';
      selectedPhotos = [];
      return;
    }
    photoPreview.innerHTML = '';
    selectedPhotos.forEach(file => {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      photoPreview.appendChild(img);
    });
  });

  // Upload image to Cloudinary
  async function uploadImage(file) {
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.3, maxWidthOrHeight: 1920 });
      const formData = new FormData();
      formData.append('file', compressed);
      formData.append('upload_preset', cloudinaryConfig.uploadPreset);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      return data;
    } catch (err) {
      console.error('Cloudinary upload failed:', err);
      alert('Photo upload failed. See console.');
      return null;
    }
  }

  // Upload & Submit
  document.getElementById('uploadBtn').addEventListener('click', async () => {
    const supName = document.getElementById('supName').value.trim();
    const date = document.getElementById('dateInput').value;
    const actId = activitySelect.value;
    const notes = document.getElementById('notes').value.trim();

    if (!supName || !date || !actId || selectedPhotos.length < 3) {
      alert('Please fill all fields and select 3–9 photos.');
      return;
    }

    document.getElementById('status').textContent = 'Uploading photos...';

    const uploadResults = await Promise.all(selectedPhotos.map(f => uploadImage(f)));
    const urls = uploadResults.filter(r => r).map(up => ({ url: up.secure_url }));

    if (urls.length !== selectedPhotos.length) {
      document.getElementById('status').textContent = 'Some photos failed to upload.';
      return;
    }

    // Get activity details for department
    const actDoc = await db.collection('activities').doc(actId).get();
    const activityName = actDoc.data().name;
    const department = actDoc.data().department; // <-- department stored here

    await db.collection('submissions').add({
      date,
      activityId: actId,
      activityName,
      department,         // store department for admin filtering
      supervisor: supName,
      notes,
      photos: urls,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    document.getElementById('status').textContent = 'Uploaded successfully!';
    loadMySubs();

    // Reset
    photoInput.value = '';
    photoPreview.innerHTML = '';
    selectedPhotos = [];
  });

  // Load recent submissions
  async function loadMySubs() {
    const container = document.getElementById('mySubs');
    const supName = document.getElementById('supName').value.trim();
    if (!supName) { container.innerHTML = '<div class="small muted">Enter supervisor name</div>'; return; }

    container.innerHTML = 'Loading...';
    const q = await db.collection('submissions')
      .where('supervisor', '==', supName)
      .orderBy('timestamp', 'desc').limit(5)
      .get();

    if (q.empty) { container.innerHTML = '<div class="small muted">No recent submissions.</div>'; return; }

    container.innerHTML = '';
    q.forEach(doc => {
      const d = doc.data();
      const card = document.createElement('div');
      card.className = 'sub-card';
      card.innerHTML = `
        <div><b>${d.activityName}</b> — ${d.date} • [${d.department}]</div>
        <div class="grid-3" style="margin-top:6px;">
          ${d.photos.map(p => `<img src="${p.url}">`).join('')}
        </div>`;
      container.appendChild(card);
    });
  }

  document.getElementById('previewPpt').addEventListener('click', async () => {
    const supName = document.getElementById('supName').value.trim();
    if (!supName) return alert('Enter supervisor name');
    const q = await db.collection('submissions')
      .where('supervisor', '==', supName)
      .orderBy('timestamp', 'desc').limit(5)
      .get();

    const subs = q.docs.map(d => d.data());
    if (!subs.length) return alert('No submissions to preview');

    const records = subs.map(s => ({
      activity: s.activityName,
      supervisor: s.supervisor,
      notes: s.notes || '',
      photos: s.photos.slice(0, 9)
    }));
    generateMultiSlidePPT(records, `Preview_${supName}.pptx`);
  });

  // Initial load
  loadMySubs();
});