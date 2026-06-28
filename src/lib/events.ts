export const clientWatchers = new Map<string, Set<(status: any) => void>>();

export function notifyWatcher(clientId: string, status: any) {
  const watchers = clientWatchers.get(clientId);
  if (!watchers) return;
  for (const cb of watchers) {
    try { cb(status); } catch {}
  }
}

const changeCounters = new Map<string, number>();

export function incrementChangeCounter(clientId: string) {
  changeCounters.set(clientId, (changeCounters.get(clientId) ?? 0) + 1);
}

export function getChangeCounter(clientId: string): number {
  return changeCounters.get(clientId) ?? 0;
}

let globalCounter = 0;

export function notifyAdmin() {
  globalCounter++;
}

export function getGlobalCounter(): number {
  return globalCounter;
}
