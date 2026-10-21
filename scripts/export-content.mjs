// Exports every post and site setting to export/ as JSON and CSV, so the
// portfolio can be backed up or moved to another account or service.
//   node scripts/export-content.mjs [site-url]
// Photos are referenced by file name and by their live URL; copy
// site/images/uploads/ alongside the export to keep the originals.
import fs from 'node:fs';
import path from 'node:path';

const repo = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const content = path.join(repo, 'site/content');
const out = path.join(repo, 'export');
const siteUrl = (process.argv[2] || 'https://jeongyunmi.com').replace(/\/$/, '');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const site = read(path.join(content, 'site.json'));
const orderFile = path.join(content, 'order.json');
const featured = fs.existsSync(orderFile) ? (read(orderFile).featured || []) : [];
const config = fs.readFileSync(path.join(repo, 'site/admin/config.yml'), 'utf8');
const categories = (config.match(/options: \[([^\]]*)\]/) || [, ''])[1].split(',').map((s) => s.trim()).filter(Boolean);

const imagePath = (i) => (typeof i === 'string' ? i : i && i.image) || '';
const url = (p) => (p ? siteUrl + p : '');

const posts = fs.readdirSync(path.join(content, 'posts'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => {
    const id = f.replace(/\.json$/, '');
    const p = read(path.join(content, 'posts', f));
    const images = (p.images || []).map(imagePath).filter(Boolean);
    const rank = featured.findIndex((x) => x === id || x === p.title);
    return {
      id,
      title: p.title || '',
      date: String(p.date || '').slice(0, 10),
      category: p.category || '',
      draft: p.draft === true,
      featuredRank: rank === -1 ? null : rank + 1,
      credits: (p.credits || []).filter((c) => c && c.role && c.name),
      tags: p.tags || [],
      instagram: p.instagram || '',
      cover: p.cover || '',
      images,
      pageUrl: `${siteUrl}/post.html?id=${encodeURIComponent(id)}`,
    };
  })
  .sort((a, b) => (a.featuredRank ?? Infinity) - (b.featuredRank ?? Infinity) || b.date.localeCompare(a.date));

const photos = [...new Set(posts.flatMap((p) => [p.cover, ...p.images]).concat(site.heroImage || []).filter(Boolean))];

fs.mkdirSync(out, { recursive: true });

fs.writeFileSync(path.join(out, 'portfolio.json'), JSON.stringify({
  exportedAt: new Date().toISOString(),
  siteUrl,
  site,
  categories,
  featuredOrder: featured,
  posts: posts.map((p) => ({ ...p, coverUrl: url(p.cover), imageUrls: p.images.map(url) })),
}, null, 2) + '\n');

// CSV with a BOM so Excel opens the Korean text correctly.
const cell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows) => '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';

fs.writeFileSync(path.join(out, 'posts.csv'), csv([
  ['no', 'id', 'title', 'date', 'category', 'draft', 'featured_rank', 'credits', 'tags',
    'instagram', 'cover_file', 'image_files', 'image_count', 'cover_url', 'image_urls', 'page_url'],
  ...posts.map((p, i) => [
    i + 1, p.id, p.title, p.date, p.category, p.draft ? 'yes' : '', p.featuredRank ?? '',
    p.credits.map((c) => `${c.role}: ${c.name}`).join(' / '), p.tags.join(', '), p.instagram,
    path.basename(p.cover), p.images.map((x) => path.basename(x)).join(' | '), p.images.length,
    url(p.cover), p.images.map(url).join(' | '), p.pageUrl,
  ]),
]));

fs.writeFileSync(path.join(out, 'credits.csv'), csv([
  ['post_id', 'post_title', 'role', 'name'],
  ...posts.flatMap((p) => p.credits.map((c) => [p.id, p.title, c.role, c.name])),
]));

fs.writeFileSync(path.join(out, 'site.csv'), csv([
  ['field', 'value'],
  ...Object.entries(site).map(([k, v]) => [k, k === 'heroImage' ? url(v) : v]),
  ['categories', categories.join(', ')],
]));

fs.writeFileSync(path.join(out, 'photos.csv'), csv([
  ['file', 'url', 'used_by'],
  ...photos.map((ph) => [path.basename(ph), url(ph),
    [ph === site.heroImage ? 'main photo' : '', ...posts.filter((p) => p.cover === ph || p.images.includes(ph)).map((p) => p.id)]
      .filter(Boolean).join(' | ')]),
]));

console.log(`export/: ${posts.length} posts, ${photos.length} photos, ${posts.reduce((n, p) => n + p.credits.length, 0)} credits`);
