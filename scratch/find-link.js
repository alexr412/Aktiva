const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'invite-render.html');
const html = fs.readFileSync(filePath, 'utf8');

console.log('Total occurrences of FROS2:', (html.match(/FROS2/g) || []).length);

let index = html.indexOf('FROS2');
while (index !== -1) {
  console.log('--- Occurrence ---');
  console.log(html.slice(Math.max(0, index - 80), index + 120));
  index = html.indexOf('FROS2', index + 1);
}
