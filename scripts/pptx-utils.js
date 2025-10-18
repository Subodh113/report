// pptx-utils.js — Generate PowerPoint where each slide is one activity with 3x3 images
async function generateMultiSlidePPT(records, filename) {
  if (!records || !records.length) {
    alert('No records to generate.');
    return;
  }

  const pptx = new PptxGenJS();
  const imgW = 2.98, imgH = 1.68, cols = 3, rows = 3, gap = 0.15;
  const slideW = pptx.width || 10;
  const totalW = cols * imgW + (cols - 1) * gap;
  const marginX = Math.max(0.3, (slideW - totalW) / 2);
  const marginY = 0.9;

  for (const rec of records) {
    const slide = pptx.addSlide();
    slide.addText(`${rec.activity} — ${rec.supervisor || ''}`, { x: 0.3, y: 0.2, fontSize: 14, bold: true });
    if (rec.notes) slide.addText('Notes: ' + rec.notes, { x: 0.3, y: 0.5, fontSize: 9, color: '666666' });

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const photo = rec.photos[idx];
        if (!photo) continue;

        const x = marginX + c * (imgW + gap);
        const y = marginY + r * (imgH + gap);

        try {
          const base64 = await urlToBase64(photo.url || photo.data);
          slide.addImage({ data: base64, x, y, w: imgW, h: imgH });
        } catch (e) {
          console.error('Failed to embed image', photo.url, e);
        }

        slide.addText(photo.desc || `Photo ${idx + 1}`, {
          x,
          y: y + imgH + 0.03,
          w: imgW,
          fontSize: 9,
          align: 'center'
        });
      }
    }
  }

  await pptx.writeFile({
    fileName: filename || `EHS_${new Date().toISOString().slice(0, 10)}.pptx`
  });
}

// Convert remote image URL (Cloudinary) to base64
async function urlToBase64(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
