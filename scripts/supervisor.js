// supervisor.js — Supervisor portal using Cloudinary + Firestore
// Author: Senior Developer (optimized 2025 build)

const CLOUD_NAME = "dsonhgs2i";     // from your Cloudinary dashboard
const UPLOAD_PRESET = "Carrier";    // unsigned preset you created
const uploadEndpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

let selectedFiles = [];

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  if (!firebase || !auth) {
    alert("Firebase not configured");
    return;
  }

  auth.onAuthStateChanged(async (u) => {
    if (!u) {
      window.location.href = "index.html";
      return;
    }
    document.getElementById("userInfo").textContent = u.email;
    await loadActivities();
    buildPhotoGrid();
    document.getElementById("uploadBtn").addEventListener("click", handleSubmit);
    document.getElementById("previewPpt").addEventListener("click", localPreview);
  });
});

// ---------------- Activity List ----------------
async function loadActivities() {
  const sel = document.getElementById("activitySelect");
  const q = await db.collection("activities").orderBy("name").get();
  sel.innerHTML = "";
  q.forEach((doc) => {
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = doc.data().name;
    sel.appendChild(opt);
  });
}

// ---------------- Photo Grid ----------------
function buildPhotoGrid() {
  const grid = document.getElementById("photoGrid");
  grid.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const slot = document.createElement("div");
    slot.className = "photo-slot";
    slot.innerHTML = `<input type="file" accept="image/*" style="display:none" id="file${i}">`;
    slot.addEventListener("click", () => document.getElementById(`file${i}`).click());
    const fileInput = slot.querySelector("input");
    fileInput.addEventListener("change", (e) => previewFile(i, e));
    grid.appendChild(slot);
  }
}

async function previewFile(index, event) {
  const file = event.target.files[0];
  if (!file) return;
  const compressed = await compressImage(file);
  selectedFiles[index] = compressed;

  const reader = new FileReader();
  reader.onload = (e) => {
    const slot = document.querySelectorAll(".photo-slot")[index];
    slot.innerHTML = `<img src="${e.target.result}">`;
  };
  reader.readAsDataURL(compressed);
}

async function compressImage(file) {
  const opts = {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
  };
  try {
    return await imageCompression(file, opts);
  } catch (err) {
    console.error("Compression error", err);
    return file;
  }
}

// ---------------- Upload & Submit ----------------
async function handleSubmit() {
  const date = document.getElementById("dateInput").value;
  const supName = document.getElementById("supName").value.trim();
  const notes = document.getElementById("notes").value.trim();
  const actId = document.getElementById("activitySelect").value;
  const actName =
    document.getElementById("activitySelect").selectedOptions[0].textContent;

  if (!date || !supName || !actId) {
    alert("Fill all fields");
    return;
  }

  if (selectedFiles.filter(Boolean).length !== 9) {
    alert("Please upload exactly 9 photos");
    return;
  }

  const status = document.getElementById("status");
  status.textContent = "Uploading photos...";

  const photos = [];
  for (let i = 0; i < 9; i++) {
    const file = selectedFiles[i];
    const url = await uploadToCloudinary(file);
    photos.push({ url });
    status.textContent = `Uploaded ${i + 1}/9`;
  }

  await db.collection("submissions").add({
    date,
    supervisor: supName,
    notes,
    activityId: actId,
    activityName: actName,
    photos,
    createdAt: new Date().toISOString(),
  });

  status.textContent = "Submitted successfully!";
  buildPhotoGrid();
  selectedFiles = [];
  loadMySubs(supName);
}

async function uploadToCloudinary(file) {
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);
  const res = await fetch(uploadEndpoint, { method: "POST", body: form });
  const data = await res.json();
  return data.secure_url;
}

// ---------------- Local PPT Preview ----------------
async function localPreview() {
  if (selectedFiles.filter(Boolean).length === 0) return alert("Upload photos first");

  const slides = [
    {
      activity: document.getElementById("activitySelect").selectedOptions[0].textContent,
      supervisor: document.getElementById("supName").value,
      notes: document.getElementById("notes").value,
      photos: await Promise.all(
        selectedFiles.map(async (f) => {
          const dataUrl = await fileToDataUrl(f);
          return { url: dataUrl };
        })
      ),
    },
  ];

  await generateMultiSlidePPT(slides, "preview.pptx");
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

// ---------------- Recent Submissions ----------------
async function loadMySubs(name) {
  const q = await db
    .collection("submissions")
    .where("supervisor", "==", name)
    .orderBy("date", "desc")
    .limit(5)
    .get();

  const c = document.getElementById("mySubs");
  c.innerHTML = "";
  q.forEach((d) => {
    const data = d.data();
    const div = document.createElement("div");
    div.className = "sub-card";
    div.innerHTML = `
      <strong>${data.activityName}</strong>
      <div class="small muted">${data.date}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${data.photos
          .slice(0, 3)
          .map(
            (p) =>
              `<img src="${p.url}" width="64" height="48" style="object-fit:cover;border-radius:6px">`
          )
          .join("")}
      </div>`;
    c.appendChild(div);
  });
}
