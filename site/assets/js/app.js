/* Renders the home (About), portfolio grid and post detail pages from data/posts.js. */
(() => {
  const SITE = window.SITE;
  const POSTS = window.POSTS;

  // Where each link points. The single-file preview swaps these for #hash routes.
  const ROUTES = window.ROUTES || {
    home: 'index.html',
    about: 'index.html#about',
    contact: 'index.html#contact',
    portfolio: 'portfolio.html',
    post: (id) => `post.html?id=${encodeURIComponent(id)}`,
  };
  const query = window.PREVIEW ? new URLSearchParams() : new URLSearchParams(location.search);

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const $ = (sel) => document.querySelector(sel);

  // On Netlify, uploads go through its image CDN: resized, and WebP/AVIF where supported.
  const imgUrl = (src, width) => (window.IMAGE_CDN && src.startsWith('/')
    ? `/.netlify/images?url=${encodeURIComponent(src)}&w=${width}`
    : src);

  const media = (src, ratio, label, { rounded = false, alt = '', eager = false, width = 1600 } = {}) => `
    <div class="media lighten ${ratio}${rounded ? ' rounded' : ''}">
      ${src
        ? `<img src="${esc(imgUrl(src, width))}" alt="${esc(alt)}"${eager ? '' : ' loading="lazy"'}>`
        : `<span class="ph">${esc(label)}</span>`}
    </div>`;

  // Header / footer shared by every page; `page` marks the current nav item.
  function chrome(page) {
    const current = (name) => (name === page ? ' aria-current="page"' : '');
    $('[data-nav]').innerHTML = `
      <a class="nav-brand" href="${ROUTES.home}">${esc(SITE.brand)}</a>
      <a href="${ROUTES.portfolio}"${current('portfolio')}>Portfolio</a>
      <a href="${ROUTES.about}"${current('about')}>About</a>
      <a href="${ROUTES.contact}">Contact</a>
      <a href="${esc(SITE.instagramUrl)}" target="_blank" rel="noopener">Instagram</a>`;
    $('[data-footer]').innerHTML = `
      <span>© ${new Date().getFullYear()} ${esc(SITE.name)} Makeup</span>
      <a href="${esc(SITE.instagramUrl)}" target="_blank" rel="noopener">${esc(SITE.instagramHandle)}</a>`;
    document.querySelectorAll('[data-link]').forEach((a) => { a.href = ROUTES[a.dataset.link]; });
  }

  const card = (p, { ratio = 'r-4-5', label = 'Cover image', meta = true } = {}) => `
    <a class="card-post" href="${ROUTES.post(p.id)}">
      ${media(p.cover || p.images[0], ratio, label, { rounded: true, alt: p.title, width: 900 })}
      <div class="meta">
        ${meta ? `<span class="kicker">${esc(p.category)} · ${esc(p.date)}</span>` : ''}
        <span class="title">${esc(p.title)}</span>
      </div>
    </a>`;

  function renderHome() {
    $('[data-name]').textContent = SITE.name;
    $('[data-tagline]').textContent = SITE.tagline;
    $('[data-about]').textContent = SITE.about;
    $('[data-hero]').innerHTML = media(SITE.heroImage, 'r-4-5', 'Main photo', { alt: SITE.name, eager: true });

    const ig = $('[data-ig]');
    ig.href = SITE.instagramUrl;
    ig.textContent = 'Instagram ' + SITE.instagramHandle;
    const mail = $('[data-mail]');
    if (SITE.email) {
      mail.href = 'mailto:' + SITE.email;
      mail.textContent = SITE.email;
    } else {
      mail.remove();
    }
  }

  function renderPortfolio() {
    $('[data-portfolio-intro]').textContent = SITE.portfolioIntro;
    const filters = $('[data-filters]');
    const grid = $('[data-grid]');
    let active = query.get('category') || 'All';

    const draw = () => {
      filters.innerHTML = SITE.filters.map((f) => `
        <button type="button" class="tag tag-outline" aria-pressed="${f === active}" data-f="${esc(f)}">${esc(f)}</button>`).join('');
      const list = active === 'All' ? POSTS : POSTS.filter((p) => p.category === active);
      grid.innerHTML = list.length
        ? list.map((p) => card(p)).join('')
        : '<p class="empty">No posts in this category yet.</p>';
    };

    filters.addEventListener('click', (e) => {
      const b = e.target.closest('[data-f]');
      if (!b) return;
      active = b.dataset.f;
      if (!window.PREVIEW) {
        const url = new URL(location.href);
        if (active === 'All') url.searchParams.delete('category');
        else url.searchParams.set('category', active);
        history.replaceState(null, '', url);
      }
      draw();
    });
    draw();
  }

  // Gallery rhythm from the 1b mock: 4:5 · (3:4 + 3:4) · 3:2 · 4:5, then 4:5.
  // Only real photos are laid out; a lone leftover in a pair spans the full width.
  function gallery(images) {
    if (!images.length) return media('', 'r-4-5', 'Image 01');
    const at = (i, ratio) => media(images[i], ratio, '', { alt: '' });
    let html = at(0, 'r-4-5');
    if (images.length > 2) html += `<div class="pair">${at(1, 'r-3-4')}${at(2, 'r-3-4')}</div>`;
    else if (images[1]) html += at(1, 'r-4-5');
    if (images[3]) html += at(3, 'r-3-2');
    for (let i = 4; i < images.length; i++) html += at(i, 'r-4-5');
    return html;
  }

  function renderPost(id = query.get('id')) {
    const idx = Math.max(0, POSTS.findIndex((p) => p.id === id));
    const p = POSTS[idx];
    document.title = `${p.title} — ${SITE.name}`;

    $('[data-kicker]').textContent = `${p.category} · ${p.date}`;
    $('[data-title]').textContent = p.title;
    const credits = p.credits.filter((c) => c.name);
    $('[data-credits]').hidden = !credits.length;
    $('[data-credits]').innerHTML = credits
      .map((c) => `<dt>${esc(c.role)}</dt><dd>${esc(c.name)}</dd>`).join('');
    // A post with only a cover still shows that photo on its page.
    $('[data-gallery]').innerHTML = gallery(p.images.length ? p.images : [p.cover].filter(Boolean));

    $('[data-tags]').innerHTML =
      p.tags.map((t) => `<span class="tag tag-neutral">${esc(t)}</span>`).join('') +
      (p.instagram ? `<a class="tag tag-outline" href="${esc(p.instagram)}" target="_blank" rel="noopener">View on Instagram</a>` : '');

    // Posts are newest first: "Previous" is the older post (next in the array).
    const older = POSTS[idx + 1];
    const newer = POSTS[idx - 1];
    $('[data-pager]').innerHTML =
      (older ? `<a href="${ROUTES.post(older.id)}"><span class="l">← Previous Post</span><span class="t">${esc(older.title)}</span></a>` : '') +
      (newer ? `<a class="next" href="${ROUTES.post(newer.id)}"><span class="l">Next Post →</span><span class="t">${esc(newer.title)}</span></a>` : '');

    const recent = POSTS.filter((q) => q !== p).slice(0, 3);
    $('[data-recent]').closest('.recent').hidden = !recent.length;
    $('[data-recent]').innerHTML = recent
      .map((q) => card(q, { ratio: 'r-3-2', label: 'Cover', meta: false })).join('');
  }

  window.App = { chrome, renderHome, renderPortfolio, renderPost };
  if (window.PREVIEW) return;

  const page = document.body.dataset.page;
  chrome(page === 'home' ? 'about' : 'portfolio');
  ({ home: renderHome, portfolio: renderPortfolio, post: renderPost })[page]();
})();
