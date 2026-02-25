const fs = require('fs');
const content = fs.readFileSync('components/CalendarScreen.tsx', 'utf8');

let level = 0;
const lines = content.split('\n');
for (let i = 404; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) continue;

    const prev = level;
    const o = (line.match(/<div(\s|>)/g) || []).length;
    const c = (line.match(/<\/div>/g) || []).length;

    level += o - c;
    console.log(`[${i + 1}] prev:${prev} new:${level} | ${line.trim().substring(0, 50)}`);

    if (level === 0 && o === 0 && c === 0 && line.includes(');')) break;
}
