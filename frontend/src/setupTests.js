import '@testing-library/jest-dom/vitest';

// Node (từ bản 22+) có global `localStorage` build-in riêng, tách biệt và không
// hoạt động đầy đủ nếu thiếu cờ `--localstorage-file`. Nó có thể đè lên
// localStorage của jsdom trong môi trường test, khiến app.getItem/clear... lỗi
// dù code chạy đúng trên trình duyệt thật. Ép dùng một bản in-memory riêng cho
// test, không phụ thuộc version Node hay cờ CLI nào.
class MemoryStorage {
  constructor() { this._data = new Map(); }
  getItem(key) { return this._data.has(key) ? this._data.get(key) : null; }
  setItem(key, value) { this._data.set(key, String(value)); }
  removeItem(key) { this._data.delete(key); }
  clear() { this._data.clear(); }
  key(index) { return Array.from(this._data.keys())[index] ?? null; }
  get length() { return this._data.size; }
}

const memoryStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true, writable: true });
Object.defineProperty(window, 'localStorage', { value: memoryStorage, configurable: true, writable: true });
