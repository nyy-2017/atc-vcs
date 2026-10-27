/** 简易 SSE 广播中心：向所有已连接前端推送实时事件 */
const clients = new Set();

export function addClient(res) {
  clients.add(res);
  return () => clients.delete(res);
}

export function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

export function clientCount() {
  return clients.size;
}

setInterval(() => {
  for (const res of clients) {
    try {
      res.write(': ping\n\n');
    } catch {
      clients.delete(res);
    }
  }
}, 15000).unref?.();
