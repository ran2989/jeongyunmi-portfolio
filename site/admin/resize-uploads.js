/*
 * Prepares photos in the browser before Decap uploads them.
 *
 * 1. Shrink: GitHub rejects large files sent through its API ("your input was
 *    too large to process"), and phone photos are often several MB. Each image
 *    is redrawn to at most MAX_EDGE px on its long side as a JPEG, which also
 *    turns iPhone HEIC photos into a format every browser shows.
 * 2. Crop: a full-screen cropper (vendor/cropper.min.js) lets the photo be
 *    trimmed to the site's frame ratios before it is saved, or used as is.
 */
(() => {
  const MAX_EDGE = 2400;
  const QUALITY = 0.88;
  const SKIP = 'preparedUploads';

  // Frame ratios used on the site; see the gallery layout in assets/js/app.js.
  const RATIOS = [
    { label: '자유', value: NaN },
    { label: '4:5 세로', hint: '대표·1번째', value: 4 / 5 },
    { label: '3:4 세로', hint: '2·3번째', value: 3 / 4 },
    { label: '3:2 가로', hint: '4번째', value: 3 / 2 },
    { label: '1:1', value: 1 },
  ];

  const isPhoto = (file) => /^image\//.test(file.type) && !/svg|gif/.test(file.type)
    || /\.(heic|heif)$/i.test(file.name);

  // Plain ASCII file names: phones send Korean names in decomposed Unicode (NFD),
  // which can stop the photo's link from matching the file on the server.
  const jpegName = (name) => {
    let base = name.replace(/\.[^.]+$/, '').normalize('NFC').toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    if (!/[a-z]{2}|\d{3}/.test(base)) {
      const t = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      base = `photo-${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}-${Math.random().toString(36).slice(2, 6)}`;
    }
    return `${base}.jpg`;
  };
  const withName = (file) => (file.name === jpegName(file.name) ? file
    : new File([file], jpegName(file.name), { type: file.type, lastModified: file.lastModified }));
  const toJpeg = (canvas, name) => new Promise((resolve) => canvas.toBlob(
    (blob) => resolve(blob && new File([blob], jpegName(name), { type: 'image/jpeg', lastModified: Date.now() })),
    'image/jpeg', QUALITY,
  ));

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
    const out = await toJpeg(canvas, file.name);
    if (!out) return file;
    // A small JPEG that needed no resizing is kept as it was.
    return scale === 1 && file.type === 'image/jpeg' && file.size <= out.size ? file : out;
  }

  const CSS = `
    .pc-overlay { position: fixed; inset: 0; z-index: 2147483000; display: flex; flex-direction: column;
      background: #15161c; color: #f2f2f5; font: 15px/1.4 -apple-system, BlinkMacSystemFont, "Pretendard", system-ui, sans-serif;
      padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px); }
    .pc-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; }
    .pc-head strong { font-size: 16px; font-weight: 600; }
    .pc-head small { display: block; color: #a9abb8; font-size: 12px; }
    .pc-stage { position: relative; flex: 1; min-height: 0; overflow: hidden; }
    /* Absolute so the cropper gets a fixed box: a tall photo must not push the buttons off screen. */
    .pc-box { position: absolute; inset: 0 16px; }
    .pc-box img { display: block; max-width: 100%; max-height: 100%; }
    .pc-ratios { display: flex; gap: 8px; overflow-x: auto; padding: 12px 16px 4px; }
    .pc-ratios button { flex: none; min-height: 40px; padding: 6px 12px; border-radius: 8px; border: 1px solid #4a4c5a;
      background: transparent; color: inherit; font: inherit; font-size: 13px; line-height: 1.2; }
    .pc-ratios button small { display: block; color: #a9abb8; font-size: 11px; }
    .pc-ratios button[aria-pressed="true"] { border-color: #9184d9; background: rgba(145, 132, 217, .22); }
    .pc-actions { display: flex; gap: 8px; padding: 12px 16px 16px; }
    .pc-actions button { flex: 1; min-height: 48px; border-radius: 10px; border: 1px solid #4a4c5a; background: transparent;
      color: inherit; font: inherit; font-weight: 600; }
    .pc-actions .pc-done { background: #9184d9; border-color: #9184d9; color: #15161c; }
    .pc-close { min-width: 44px; min-height: 44px; border: 0; background: transparent; color: inherit; font-size: 22px; }
  `;

  // Resolves to the cropped file, the file unchanged ("자르지 않고 사용"), or null (upload cancelled).
  function cropDialog(file, index, total) {
    if (!window.Cropper) return Promise.resolve(file);
    if (!document.getElementById('pc-style')) {
      const style = document.createElement('style');
      style.id = 'pc-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const overlay = document.createElement('div');
      overlay.className = 'pc-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-label', '사진 자르기');
      overlay.innerHTML = `
        <div class="pc-head">
          <div><strong>사진 자르기${total > 1 ? ` (${index + 1}/${total})` : ''}</strong>
            <small>사진을 끌어 위치를 맞추고, 모서리로 영역을 조절하세요.</small></div>
          <button type="button" class="pc-close" aria-label="업로드 취소">×</button>
        </div>
        <div class="pc-stage"><div class="pc-box"><img alt=""></div></div>
        <div class="pc-ratios" role="group" aria-label="비율">
          ${RATIOS.map((r, i) => `<button type="button" data-i="${i}" aria-pressed="${i === 0}">${r.label}${r.hint ? `<small>${r.hint}</small>` : ''}</button>`).join('')}
        </div>
        <div class="pc-actions">
          <button type="button" class="pc-skip">자르지 않고 사용</button>
          <button type="button" class="pc-done">자르기 완료</button>
        </div>`;
      document.body.appendChild(overlay);

      const img = overlay.querySelector('img');
      let cropper;
      img.onload = () => {
        cropper = new window.Cropper(img, {
          viewMode: 1, dragMode: 'move', autoCropArea: 1, background: false,
          toggleDragModeOnDblclick: false, responsive: true,
        });
      };
      img.src = url;

      const finish = (result) => {
        if (cropper) cropper.destroy();
        URL.revokeObjectURL(url);
        overlay.remove();
        resolve(result);
      };

      overlay.querySelector('.pc-ratios').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-i]');
        if (!b || !cropper) return;
        overlay.querySelectorAll('.pc-ratios button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        cropper.setAspectRatio(RATIOS[Number(b.dataset.i)].value);
      });
      overlay.querySelector('.pc-close').addEventListener('click', () => finish(null));
      overlay.querySelector('.pc-skip').addEventListener('click', () => finish(file));
      overlay.querySelector('.pc-done').addEventListener('click', async () => {
        if (!cropper) return finish(file);
        const canvas = cropper.getCroppedCanvas({ maxWidth: MAX_EDGE, maxHeight: MAX_EDGE, imageSmoothingQuality: 'high' });
        finish((canvas && await toJpeg(canvas, file.name)) || file);
      });
    });
  }

  // Runs before Decap's own handler: hold the event, swap in prepared files, then replay it.
  window.addEventListener('change', async (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file' || input.dataset[SKIP]) return;
    const files = [...(input.files || [])];
    if (!files.some(isPhoto)) return;

    e.stopImmediatePropagation();
    const out = new DataTransfer();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!isPhoto(f)) { out.items.add(f); continue; }
      let ready = f;
      try { ready = await shrink(f); } catch (err) { /* upload the original */ }
      const cropped = await cropDialog(ready, i, files.length);
      if (cropped) out.items.add(withName(cropped));
    }
    if (!out.files.length) { input.value = ''; return; }
    input.files = out.files;
    input.dataset[SKIP] = '1';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    delete input.dataset[SKIP];
  }, true);
})();
