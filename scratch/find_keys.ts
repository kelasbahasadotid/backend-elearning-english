import * as fs from 'fs';
import * as path from 'path';

function getFiles(dir: string): string[] {
  let res: string[] = [];
  if (!fs.existsSync(dir)) return res;
  for (const item of fs.readdirSync(dir)) {
    const p = path.join(dir, item);
    if (fs.statSync(p).isDirectory()) {
      res = res.concat(getFiles(p));
    } else if (p.endsWith('.tsx')) {
      res.push(p);
    }
  }
  return res;
}

const frontendSrc = path.resolve(__dirname, '../../frontend-elearning-english/src');
const files = getFiles(frontendSrc);

console.log(`Found ${files.length} tsx files.`);

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    if (l.includes('key={') && (l.includes('.id') || l.includes('item.id') || l.includes('lesson.id') || l.includes('m.id') || l.includes('les.id') || l.includes('c.id') || l.includes('pkg.id'))) {
      const rel = path.relative(frontendSrc, f);
      console.log(`${rel}:${idx + 1} -> ${l.trim()}`);
    }
  });
}
