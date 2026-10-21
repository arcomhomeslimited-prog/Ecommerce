// Downloads the starter catalogue photography from Unsplash into
// public/images/catalog so the site never depends on hot-linked images.
const fs = require('node:fs');
const path = require('node:path');
const { allImageIds, lifestyle } = require('../src/catalog');

const outDir = path.join(__dirname, '..', 'public', 'images', 'catalog');
fs.mkdirSync(outDir, { recursive: true });

const wide = new Set(Object.values(lifestyle));

async function download(id) {
  const file = path.join(outDir, `${id}.jpg`);
  if (fs.existsSync(file)) return 'skip';
  const w = wide.has(id) ? 1800 : 1000;
  const url = `https://images.unsplash.com/photo-${id}?w=${w}&q=72&fm=jpg&fit=max`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return 'ok';
}

(async () => {
  const ids = allImageIds();
  let done = 0, failed = 0;
  const queue = [...ids];
  async function worker() {
    while (queue.length) {
      const id = queue.shift();
      try { await download(id); done++; } catch (e) { failed++; console.error('  ✗', e.message); }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`Images ready: ${done}/${ids.length}${failed ? ` (${failed} failed – re-run to retry)` : ''}`);
})();
