import AsyncStorage from "@react-native-async-storage/async-storage";
import { User, PendingSync } from "@/types";

const KEYS = {
  USER: "@wolfpack_d2d_user",
  AUTH_TOKEN: "@wolfpack_d2d_token",
  PENDING_SYNC: "@wolfpack_d2d_pending_sync",
};

export async function getStoredUser(): Promise<User | null> {
  try {
    const json = await AsyncStorage.getItem(KEYS.USER);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

export async function setStoredUser(user: User | null): Promise<void> {
  try {
    if (user) {
      await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem(KEYS.USER);
    }
  } catch {
    console.error("Failed to store user");
  }
}

export async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEYS.AUTH_TOKEN);
  } catch {
    return null;
  }
}

export async function setAuthToken(token: string | null): Promise<void> {
  try {
    if (token) {
      await AsyncStorage.setItem(KEYS.AUTH_TOKEN, token);
    } else {
      await AsyncStorage.removeItem(KEYS.AUTH_TOKEN);
    }
  } catch {
    console.error("Failed to store auth token");
  }
}

export async function getPendingSyncs(): Promise<PendingSync[]> {
  try {
    const json = await AsyncStorage.getItem(KEYS.PENDING_SYNC);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function addPendingSync(sync: PendingSync): Promise<void> {
  try {
    const current = await getPendingSyncs();
    current.push(sync);
    await AsyncStorage.setItem(KEYS.PENDING_SYNC, JSON.stringify(current));
  } catch {
    console.error("Failed to add pending sync");
  }
}

export async function removePendingSync(id: string): Promise<void> {
  try {
    const current = await getPendingSyncs();
    const filtered = current.filter((s) => s.id !== id);
    await AsyncStorage.setItem(KEYS.PENDING_SYNC, JSON.stringify(filtered));
  } catch {
    console.error("Failed to remove pending sync");
  }
}

export async function clearPendingSyncs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.PENDING_SYNC);
  } catch {
    console.error("Failed to clear pending syncs");
  }
}

export async function clearAllStorage(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      KEYS.USER,
      KEYS.AUTH_TOKEN,
      KEYS.PENDING_SYNC,
    ]);
  } catch {
    console.error("Failed to clear storage");
  }
}
