const { spawn } = require('child_process');
const path = require('path');

const targetScript = path.join(__dirname, '../functions/backfill_places.js');
const args = process.argv.slice(2);

console.log(`Delegating execution to: ${targetScript}`);
const proc = spawn('node', [targetScript, ...args], {
  cwd: path.dirname(targetScript),
  stdio: 'inherit'
});

proc.on('close', (code) => {
  process.exit(code || 0);
});
