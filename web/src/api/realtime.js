import { reactive } from 'vue';

export const realtimeState = reactive({
  connected: false,
  tick: { activeCalls: 0, busyChannels: 0, activeAlarms: 0, ts: 0 },
});

const handlers = new Map();
let es = null;

export function onRealtime(event, fn) {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event).add(fn);
  return () => handlers.get(event)?.delete(fn);
}

function emit(event, payload) {
  for (const fn of handlers.get(event) || []) {
    try {
      fn(payload);
    } catch (e) {
      console.warn('[realtime]', e);
    }
  }
}

export function connectRealtime(token) {
  disconnectRealtime();
  if (!token) return;
  es = new EventSource(`/api/stream?token=${encodeURIComponent(token)}`);

  es.addEventListener('ready', () => {
    realtimeState.connected = true;
    emit('ready', {});
  });

  for (const ev of ['tick', 'call', 'alarm', 'channel', 'position']) {
    es.addEventListener(ev, (e) => {
      let data = null;
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }
      if (ev === 'tick') Object.assign(realtimeState.tick, data);
      emit(ev, data);
    });
  }

  es.onerror = () => {
    realtimeState.connected = false;
    emit('disconnect', {});
  };
}

export function disconnectRealtime() {
  if (es) {
    es.close();
    es = null;
  }
  realtimeState.connected = false;
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', disconnectRealtime);
  window.addEventListener('beforeunload', disconnectRealtime);
}
