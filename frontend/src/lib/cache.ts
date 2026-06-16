// Simple in-memory cache with TTL.
// Lives for the browser session — no persistence needed.

interface Entry<T> { value: T; expiresAt: number }

class MemCache {
  private store = new Map<string, Entry<unknown>>()

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return null }
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs = 60_000) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  invalidate(prefix: string) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key)
    }
  }
}

export const cache = new MemCache()
