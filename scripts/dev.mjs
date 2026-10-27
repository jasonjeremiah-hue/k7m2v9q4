import { spawn } from 'node:child_process';
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const children = [
  spawn(python, ['-m', 'backend.server'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
];
let ending = false;
function stop(code = 0) {
  if (ending) return;
  ending = true;
  children.forEach(child => child.kill());
  process.exit(code);
}
children.forEach(child => {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => stop(code || 0));
});
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
