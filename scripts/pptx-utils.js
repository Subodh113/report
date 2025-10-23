// scripts/pptx-utils.js
async function generateMultiSlidePPT(records, filename) {
  if (!records || !records.length) {
    alert('No records found');
    return;
  }

  const pptx = new PptxGenJS();
  const slideW = pptx.width || 10;
  const slideH = pptx.height || 5.63;

  // Company logo (replace with your actual logo URL)
  const companyLogoURL = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyTCMtrLBcJmjce2b8m4G-bWzxVYfwpG1JdA&usqp=CAU";

  // Define colors
  const headerColor = '014d4d'; // Dark teal
  const dottedColor = '014d4d'; // Dark teal for light dots

  for (const rec of records) {
    const slide = pptx.addSlide();

    // --- APPLY DOTTED BACKGROUND (~5%) ---
    slide.background = {
      type: 'pattern',
      pattern: 'pct5',
      fgColor: dottedColor,
      bgColor: 'FFFFFF',
    };

    // --- HEADER BAR ---
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0,
      y: 0,
      w: '100%',
      h: 0.7,
      fill: { color: headerColor },
    });

    // --- SUPERVISOR NAME (top-left) ---
    const supervisorName = rec.supervisor ? `Supervisor: ${rec.supervisor}` : 'Supervisor: N/A';
    slide.addText(supervisorName, {
      x: 0.3,
      y: 0.2,
      fontSize: 10,
      color: 'FFFFFF', // White text on dark header
      bold: true,
    });

    // --- COMPANY LOGO (top-right) ---
    try {
      const logoData = await getImageBase64(companyLogoURL);
      if (logoData) {
        slide.addImage({
          data: logoData,
          x: slideW - 1.8,
          y: 0.1,
          w: 1.3,
          h: 0.5,
        });
      }
    } catch (e) {
      console.warn('Logo load failed', e);
    }

    // --- ACTIVITY TITLE (centered) ---
    slide.addText(rec.activity || "Untitled Activity", {
      x: 2.5,
      y: 0.2,
      w: 5,
      fontSize: 16,
      bold: true,
      color: 'FFFFFF', // White text on dark header
      align: 'center',
    });

    // --- IMAGES ---
    const photos = rec.photos || [];
    const count = photos.length;
    if (!count) continue;

    // Auto determine grid (max 3 per row)
    const cols = Math.min(3, count);
    const rows = Math.ceil(count / cols);

    const gap = 0.18;
    const availableHeight = slideH - 1.1; // after header
    const availableWidth = slideW - 0.6;

    const imgW = Math.min(3, (availableWidth - (cols - 1) * gap) / cols);
    const imgH = Math.min(2, (availableHeight - (rows - 1) * gap) / rows);

    // Centering margins
    const totalGridW = cols * imgW + (cols - 1) * gap;
    const totalGridH = rows * imgH + (rows - 1) * gap;
    const marginX = (slideW - totalGridW) / 2;
    const marginY = (slideH - totalGridH) / 2 + 0.2; // offset below header

    // --- PLACE IMAGES ---
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = marginX + c * (imgW + gap);
      const y = marginY + r * (imgH + gap);

      try {
        const imgData = await getImageBase64(photos[i].url || photos[i].data);
        if (imgData) {
          slide.addImage({ data: imgData, x, y, w: imgW, h: imgH });
        }
      } catch (err) {
        console.error('Image load error:', err);
      }
    }
  }

  await pptx.writeFile({
    fileName: filename || `EHS_${new Date().toISOString().slice(0, 10)}.pptx`
  });
}

// --- Helper: safely fetch image as base64 ---
async function getImageBase64(url) {
  if (!url) return null;
  if (!url.startsWith('http')) return url;
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('getImageBase64 failed', err);
    return null;
  }
}
