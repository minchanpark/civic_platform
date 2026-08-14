import { ReportItem } from '../types';

const DB_NAME = 'CivicMapAppDB';
const DB_VERSION = 1;
const STORE_NAME = 'reports';

// Open IndexedDB database
export function openLocalDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB open error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

// Fetch all reports from IndexedDB
export async function getAllDbReports(): Promise<ReportItem[]> {
  try {
    const db = await openLocalDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn('Fallback to empty array on DB read error:', err);
    return [];
  }
}

// Save or update a single report in IndexedDB
export async function saveDbReport(report: ReportItem): Promise<void> {
  try {
    const db = await openLocalDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(report);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to save report to IndexedDB:', err);
  }
}

// Save entire array of reports to IndexedDB
export async function syncAllDbReports(reports: ReportItem[]): Promise<void> {
  try {
    const db = await openLocalDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        if (reports.length === 0) {
          resolve();
          return;
        }
        let count = 0;
        reports.forEach((rep) => {
          const putReq = store.put(rep);
          putReq.onsuccess = () => {
            count++;
            if (count === reports.length) {
              resolve();
            }
          };
          putReq.onerror = () => reject(putReq.error);
        });
      };
      clearRequest.onerror = () => reject(clearRequest.error);
    });
  } catch (err) {
    console.error('Failed to bulk sync IndexedDB:', err);
  }
}

// Clear all reports in IndexedDB
export async function clearDbReports(): Promise<void> {
  try {
    const db = await openLocalDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to clear IndexedDB:', err);
  }
}
