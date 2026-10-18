/*
 * Shrinks photos in the browser before Decap uploads them.
 *
 * GitHub rejects large files sent through its API ("your input was too large
 * to process"), and phone photos are often several MB. Every image picked in
 * the admin is redrawn to at most MAX_EDGE px on its long side and saved as
 * JPEG, which also turns iPhone HEIC photos into a format every browser shows.
 * The site serves resized copies anyway, so nothing visible is lost.
 */
(() => {
  const MAX_EDGE = 2400;
  const QUALITY = 0.85;
  const SKIP = 'resizedUploads';

  const isPhoto = (file) => /^image\//.test(file.type) && !/svg|gif/.test(file.type)
    || /\.(heic|heif)$/i.test(file.name);

  const decode = async (file) => {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* fall back */ }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  async function shrink(file) {
    const img = await decode(file);
    const w = img.width || img.naturalWidth;
    const h = img.height || img.naturalHeight;
    const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob) return file;
    // A small JPEG that needed no resizing is kept as it was.
    if (scale === 1 && file.type === 'image/jpeg' && file.size <= blob.size) return file;
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  }

  // Runs before Decap's own handler: hold the event, swap in smaller files, then replay it.
  window.addEventListener('change', async (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file' || input.dataset[SKIP]) return;
    const files = [...(input.files || [])];
    if (!files.some(isPhoto)) return;

    e.stopImmediatePropagation();
    document.body.style.cursor = 'progress';
    try {
      const out = new DataTransfer();
      for (const f of files) {
        try { out.items.add(isPhoto(f) ? await shrink(f) : f); } catch (err) { out.items.add(f); }
      }
      input.files = out.files;
    } finally {
      document.body.style.cursor = '';
    }
    input.dataset[SKIP] = '1';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    delete input.dataset[SKIP];
  }, true);
})();
