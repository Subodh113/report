document.addEventListener('DOMContentLoaded', () => {
  if (!firebase || !auth) { alert('Firebase not loaded.'); return; }

  const photoInput = document.getElementById('photoInput');
  const previewGrid = document.getElementById('previewGrid');
  const status = document.getElementById('status');

  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn.addEventListener('click', () => { auth.signOut(); window.location.href = 'index.html'; });

  auth.onAuthStateChanged(async user => {
    if (!user) { window.location.href = 'index.html'; return; }
    if (!adminEmails.includes(user.email)) {
      alert('Access denied.');
      auth.signOut();
      return;
    }
    document.getElementById('userInfo').textContent = user.email;
    loadGallery();
  });

  let selectedFiles = [];

  photoInput.addEventListener('change', async e => {
    previewGrid.innerHTML = '';
    selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length < 3 || selectedFiles.length > 9) {
      alert('Please select between 3 and 9 photos.');
      e.target.value = '';
      selectedFiles = [];
      return;
    }

    for (const file of selectedFiles) {
      const box = document.createElement('div');
      box.className = 'photo-box';
      box.textContent = 'Compressing...';
      previewGrid.appendChild(box);
      try {
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.3,
          maxWidthOrHeight: 1400,
          useWebWorker: true
        });
        const reader = new FileReader();
        reader.onload = () => {
          box.innerHTML = '';
          const img = document.createElement('img');
          img.src = reader.result;
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          box.appendChild(img);
          box.dataset.imageData = reader.result;
        };
        reader.readAsDataURL(compressed);
      } catch (err) {
        console.error('Compression error:', err);
        box.textContent = 'Error';
      }
    }
  });

  document.getElementById('uploadBtn').addEventListener('click', async () => {
    const date = document.getElementById('uploadDate').value;
    const activity = document.getElementById('activityName').value.trim();
    if (!date || !activity) return alert('Please fill all fields.');
    if (selectedFiles.length < 3 || selectedFiles.length > 9) return alert('Select 3–9 photos.');

    status.textContent = 'Uploading...';
    const photosMeta = [];
    try {
      const subId = 'gallery_' + Date.now().toString(36);
      const storageFolder = `gallery/${date}/${subId}/`;

      const photoBoxes = Array.from(previewGrid.children);
      for (let i = 0; i < photoBoxes.length; i++) {
        const imgData = photoBoxes[i].dataset.imageData;
        if (!imgData) continue;
        const blob = dataURLtoBlob(imgData);
        const ref = storage.ref().child(`${storageFolder}img_${i + 1}.jpg`);
        const snap = await ref.put(blob, { contentType: 'image/jpeg' });
        const url = await snap.ref.getDownloadURL();
        photosMeta.push({ url });
      }

      const record = {
        id: subId,
        activity,
        date,
        uploader: auth.currentUser.email,
        photos: photosMeta,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('gallery').doc(subId).set(record);
      status.textContent = '✅ Uploaded successfully.';
      photoInput.value = '';
      previewGrid.innerHTML = '';
      loadGallery();
    } catch (err) {
      console.error(err);
      status.textContent = 'Upload failed: ' + err.message;
    }
  });

  function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  }

  async function loadGallery() {
    const container = document.getElementById('galleryList');
    container.innerHTML = '<div class="small muted">Loading...</div>';
    const q = await db.collection('gallery').orderBy('createdAt', 'desc').limit(20).get();
    if (q.empty) {
      container.innerHTML = '<div class="small muted">No uploads yet</div>';
      return;
    }
    container.innerHTML = '';
    q.forEach(doc => {
      const d = doc.data();
      const card = document.createElement('div');
      card.className = 'sub-card';
      card.innerHTML = `
        <div style="flex:1">
          <strong>${d.activity}</strong>
          <div class="small muted">${d.date} • ${d.uploader}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${d.photos.map(p => `<div style="width:64px;height:48px;overflow:hidden;border-radius:6px"><img src="${p.url}" style="width:100%;height:100%;object-fit:cover"></div>`).join('')}
        </div>
        <div style="margin-left:auto">
          <button class="btn secondary small" onclick="deleteGallery('${doc.id}')">Delete</button>
        </div>
      `;
      container.appendChild(card);
    });
  }
});

async function deleteGallery(id) {
  if (!confirm('Delete this gallery upload?')) return;
  await db.collection('gallery').doc(id).delete();
  alert('Deleted.');
  location.reload();
}
