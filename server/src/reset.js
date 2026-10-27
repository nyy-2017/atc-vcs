import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbFile = path.resolve(__dirname, '../data/atc-vcs.db');

for (const f of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    console.log('已删除', f);
  }
}
console.log('数据库已重置，下次启动将重新生成演示数据。');
