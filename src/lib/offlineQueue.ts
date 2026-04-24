/**
 * Offline queue for fragment writes.
 *
 * Scenario: the user is on the workspace with the page already open, then
 * loses network briefly and types a fragment. The server action throws; we
 * catch, stash the fragment in IndexedDB, and show it in the list as
 * "pending". On the next `online` event (or on SW boot) we drain.
 *
 * Store layout: one object store "fragments" keyed by a local UUID. Values
 * are { localId, content, session_date, created_at }.
 */

const DB_NAME = 'diarybuddy';
const DB_VERSION = 1;
const STORE = 'pendingFragments';

export type PendingFragment = {
  localId: string;
  content: string;
  session_date: string;
  created_at: string;
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'localId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const result = fn(store);
        if (result instanceof IDBRequest) {
          result.onsuccess = () => resolve(result.result as T);
          result.onerror = () => reject(result.error);
        } else {
          // Promise branch: wait for tx completion, then resolve.
          tx.oncomplete = () => result.then(resolve, reject);
          tx.onerror = () => reject(tx.error);
        }
      }),
  );
}

export function generateLocalId(): string {
  if (isBrowser() && 'crypto' in window && 'randomUUID' in crypto) {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueue(fragment: PendingFragment): Promise<void> {
  if (!isBrowser()) return;
  await withStore('readwrite', (store) => store.put(fragment));
}

export async function listPending(): Promise<PendingFragment[]> {
  if (!isBrowser()) return [];
  return withStore<PendingFragment[]>('readonly', (store) => store.getAll());
}

export async function removePending(localId: string): Promise<void> {
  if (!isBrowser()) return;
  await withStore('readwrite', (store) => store.delete(localId));
}

export async function clearPending(): Promise<void> {
  if (!isBrowser()) return;
  await withStore('readwrite', (store) => store.clear());
}
