const fs = require('fs');
const content = fs.readFileSync('components/CalendarScreen.tsx', 'utf8');

let divOpen = 0;
let divClose = 0;

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ignore comments
    if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) continue;

    const o = (line.match(/<div(\s|>)/g) || []).length;
    const c = (line.match(/<\/div>/g) || []).length;

    divOpen += o;
    divClose += c;
}

console.log('Opened:', divOpen, 'Closed:', divClose);
