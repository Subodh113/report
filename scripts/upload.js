// scripts/upload.js
// Compress & upload photos to Cloudinary, then save metadata to Firestore

async function compressImage(file, maxKB = 300) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Resize based on file size (rough scaling)
        const scale = Math.min(1, Math.sqrt((maxKB * 1024) / file.size));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const qualities = [0.8, 0.7, 0.6, 0.5, 0.4];
        (function tryNext(i) {
          canvas.toBlob((blob) => {
            if (blob.size <= maxKB * 1024 || i === qualities.length - 1) resolve(blob);
            else tryNext(i + 1);
          }, "image/jpeg", qualities[i]);
        })(0);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadToCloudinary(blob, filename) {
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("upload_preset", cloudinaryConfig.uploadPreset);
  form.append("folder", "ehs-cleaning");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
    { method: "POST", body: form }
  );

  if (!res.ok) throw new Error("Upload failed");
  const json = await res.json();
  return json.secure_url; // return direct image URL
}

async function uploadFilesAndSave(files, activityName, dateStr, supervisorName) {
  const uploaded = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;
    const compressed = await compressImage(file, 300);
    const url = await uploadToCloudinary(compressed, file.name);
    uploaded.push({ url, name: file.name });
  }

  const doc = {
    activityName,
    date: dateStr,
    supervisor: supervisorName,
    photos: uploaded,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  const ref = await db.collection("submissions").add(doc);
  return ref.id;
}
