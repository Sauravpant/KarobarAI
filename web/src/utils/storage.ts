import { REFRESH_TOKEN_KEY, TOKEN_KEY, USER_KEY, SHOP_KEY } from '@/constants/routes'

// Pre-rebrand keys. Copied over once so existing sessions survive the rename.
const LEGACY_KEYS: Record<string, string> = {
  vyapar_access_token: TOKEN_KEY,
  vyapar_refresh_token: REFRESH_TOKEN_KEY,
  vyapar_user: USER_KEY,
  vyapar_shop: SHOP_KEY,
}

function migrateLegacyKeys() {
  try {
    for (const [oldKey, newKey] of Object.entries(LEGACY_KEYS)) {
      const value = localStorage.getItem(oldKey)
      if (value === null) continue
      if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, value)
      localStorage.removeItem(oldKey)
    }
  } catch {
    // storage unavailable (private mode); nothing to migrate
  }
}
migrateLegacyKeys()

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export const storage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  getUser: <T>() => readJson<T>(USER_KEY),
  setUser: (user: unknown) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  getShop: <T>() => readJson<T>(SHOP_KEY),
  setShop: (shop: unknown) =>
    shop ? localStorage.setItem(SHOP_KEY, JSON.stringify(shop)) : localStorage.removeItem(SHOP_KEY),
  clearSession() {
    for (const key of [TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, SHOP_KEY]) localStorage.removeItem(key)
  },
}
