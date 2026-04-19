import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TechUser } from "@/types";

const TECH_USER_KEY = "tech_user";

export async function getTechUser(): Promise<TechUser | null> {
  try {
    const raw = await AsyncStorage.getItem(TECH_USER_KEY);
    return raw ? (JSON.parse(raw) as TechUser) : null;
  } catch {
    return null;
  }
}

export async function setTechUser(user: TechUser | null): Promise<void> {
  if (user) {
    await AsyncStorage.setItem(TECH_USER_KEY, JSON.stringify(user));
  } else {
    await AsyncStorage.removeItem(TECH_USER_KEY);
  }
}

export async function clearTechUser(): Promise<void> {
  await AsyncStorage.removeItem(TECH_USER_KEY);
}
