const DB_NAME = "voicecrm-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending-audios";

export interface PendingAudio {
  id: string;
  audioData: ArrayBuffer;
  filename: string;
  timestamp: number;
  status: "pending" | "uploading" | "failed";
  retryCount: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAudioOffline(blob: Blob): Promise<string> {
  const id = `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const arrayBuffer = await blob.arrayBuffer();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const record: PendingAudio = {
      id,
      audioData: arrayBuffer,
      filename: "recording.webm",
      timestamp: Date.now(),
      status: "pending",
      retryCount: 0,
    };
    const req = store.put(record);
    req.onsuccess = () => resolve(id);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getPendingAudios(): Promise<PendingAudio[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function updateAudioStatus(id: string, status: PendingAudio["status"], retryCount?: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record.status = status;
        if (retryCount !== undefined) record.retryCount = retryCount;
        store.put(record);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => db.close();
  });
}

export async function clearAllPendingAudios(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function removeAudio(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function uploadPendingAudio(record: PendingAudio): Promise<any> {
  const blob = new Blob([record.audioData], { type: "audio/webm" });
  const formData = new FormData();
  formData.append("audio", blob, record.filename);
  const res = await fetch("/api/meetings/process-audio", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  return res.json();
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnline(callback: () => void): () => void {
  window.addEventListener("online", callback);
  return () => window.removeEventListener("online", callback);
}

export function onOffline(callback: () => void): () => void {
  window.addEventListener("offline", callback);
  return () => window.removeEventListener("offline", callback);
}
