// admin-gallery.js
let myWidget;

document.addEventListener('DOMContentLoaded', () => {
  if (!firebase || !auth) { alert('Add firebase-config.js'); return; }

  auth.onAuthStateChanged(async user => {
    if (!user) { window.location.href = 'index.html'; return; }
    if (!adminEmails.includes(user.email)) { alert('Not authorized'); window.location.href = 'index.html'; return; }

    document.getElementById('userInfo').textContent = user.email;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await auth.signOut();
      window.location.href = 'index.html';
    });

    // Initialize Cloudinary widget once
    myWidget = cloudinary.createUploadWidget({
      cloudName: 'dsonhgs2i',
      uploadPreset: 'Carrier',
      multiple: true,
      maxFiles: 9,
      sources: ['local', 'camera', 'url'],
      folder: 'admin-gallery'
    }, async (error, result) => {
      if (error) {
        console.error(error);
        document.getElementById('uploadStatus').textContent = 'Upload failed';
        return;
      }

      if (result.event === 'queues-end' && result.info && result.info.files) {
        const uploaded = result.info.files.map(f => f.uploadInfo);
        if (uploaded.length < 3) return alert('Please upload at least 3 photos.');
        document.getElementById('uploadStatus').textContent = `Uploaded ${uploaded.length} photos`;

        for (const file of uploaded) {
          await db.collection('gallery').add({
            url: file.secure_url,
            public_id: file.public_id,
            uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
            uploader: auth.currentUser.email
          });
        }
        loadGallery();
      }
    });

    document.getElementById('uploadGalleryBtn').addEventListener('click', () => myWidget.open());
    document.getElementById('filterBtn').addEventListener('click', loadGallery);

    loadGallery();
  });
});

async function loadGallery() {
  const container = document.getElementById('uploadedPhotos');
  container.innerHTML = '<div class="small muted">Loading...</div>';

  let query = db.collection('gallery').orderBy('uploadedAt', 'desc');

  const fromDate = document.getElementById('fromDate').value;
  const toDate = document.getElementById('toDate').value;

  if (fromDate && toDate) {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
    query = query.where('uploadedAt', '>=', from).where('uploadedAt', '<=', to);
  }

  const snap = await query.limit(100).get();

  if (snap.empty) {
    container.innerHTML = '<div class="small muted">No photos found.</div>';
    return;
  }

  container.innerHTML = '';
  snap.forEach(doc => {
    const d = doc.data();
    const card = document.createElement('div');
    card.className = 'photo-box';
    card.innerHTML = `
      <div class="photo-thumb"><img src="${d.url}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"></div>
      <div class="row small" style="justify-content:space-between;">
        <span>${d.uploader || ''}</span>
        <button class="btn secondary small" onclick="deletePhoto('${doc.id}')">Delete</button>
      </div>
    `;
    container.appendChild(card);
  });
}

async function deletePhoto(id) {
  if (!confirm('Delete this photo?')) return;
  try {
    await db.collection('gallery').doc(id).delete();
    loadGallery();
  } catch (err) {
    console.error(err);
    alert('Delete failed');
  }
}
