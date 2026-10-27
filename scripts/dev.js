import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];

function run(name, cwd, args, color) {
  const child = spawn(npm, args, { cwd, shell: process.platform === 'win32', env: process.env });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m`;
  const pipe = (stream) => {
    stream.setEncoding('utf8');
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) if (line.trim()) console.log(`${prefix} ${line}`);
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on('exit', (code) => console.log(`${prefix} 进程退出，代码 ${code}`));
  children.push(child);
  return child;
}

console.log('启动后端 :3001 与前端 :5180 …\n');
run('server', path.join(root, 'server'), ['run', 'dev'], '36');
run('web', path.join(root, 'web'), ['run', 'dev'], '34');

const shutdown = () => {
  children.forEach((c) => c.kill());
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
