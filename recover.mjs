import fs from 'fs';
import path from 'path';

function extractFromPack(packPath, outDir) {
  try {
    const data = fs.readFileSync(packPath);
    const str = data.toString('latin1');
    const regex = /"sourcesContent":\["((?:[^"\\]|\\[\s\S])*)"/g;
    let match;
    let count = 0;
    while ((match = regex.exec(str)) !== null) {
      try {
        const content = JSON.parse('"' + match[1] + '"');
        const before = str.slice(Math.max(0, match.index - 300), match.index);
        const nameMatch = before.match(/"([^"]+\.(tsx?|css|json))"[^"]*$/);
        if (nameMatch && content.length > 50) {
          const rel = nameMatch[1].replace(/^.*?(app\/|components\/|hooks\/|lib\/|types\/)/, '$1');
          const outFile = path.join(outDir, rel);
          fs.mkdirSync(path.dirname(outFile), { recursive: true });
          fs.writeFileSync(outFile, content);
          count++;
        }
      } catch(e) {}
    }
    return count;
  } catch(e) { return 0; }
}

const outDir = 'recovered';
fs.mkdirSync(outDir, { recursive: true });

const packDirs = [
  '.next/cache/webpack/client-production',
  '.next/cache/webpack/server-production',
  '.next/cache/webpack/edge-server-production'
];

let total = 0;
for (const dir of packDirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.pack'));
  for (const f of files) {
    const n = extractFromPack(path.join(dir, f), outDir);
    total += n;
  }
}
console.log('Fichiers extraits:', total);
