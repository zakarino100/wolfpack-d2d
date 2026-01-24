import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { User } from "@/types";
import {
  getStoredUser,
  setStoredUser,
  setAuthToken,
  clearAllStorage,
} from "@/lib/storage";
import { getApiUrl, apiRequest } from "@/lib/query-client";

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const response = await apiRequest("GET", "/api/auth/me");
      const data = await response.json();
      if (data.user) {
        setUser(data.user);
        await setStoredUser(data.user);
      }
    } catch {
      setUser(null);
      await setStoredUser(null);
    }
  }, []);

  useEffect(() => {
    async function loadUser() {
      try {
        const storedUser = await getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }
        await refreshUser();
      } catch {
        console.error("Failed to load user");
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, [refreshUser]);

  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      console.log("Deep link received:", event.url);
      const url = new URL(event.url);
      const token = url.searchParams.get("token");
      const error = url.searchParams.get("error");
      
      if (error) {
        console.error("Auth error:", error);
        return;
      }
      
      if (token) {
        console.log("Token received, saving...");
        await setAuthToken(token);
        await refreshUser();
      }
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshUser]);

  const signInWithGoogle = useCallback(async () => {
    try {
      const baseUrlRaw = getApiUrl();
      const baseUrlObj = new URL(baseUrlRaw);
      baseUrlObj.port = "";
      const baseUrl = baseUrlObj.href;
      
      const redirectUrl = Linking.createURL("auth/callback");
      console.log("Expected redirect URL:", redirectUrl);
      
      const authUrl = `${baseUrl}api/auth/google?app_redirect_uri=${encodeURIComponent(redirectUrl)}`;
      console.log("Auth URL:", authUrl);
      
      await WebBrowser.openBrowserAsync(authUrl);
    } catch (error) {
      console.error("Google sign in failed:", error);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {
      console.error("Logout request failed");
    }
    await clearAllStorage();
    setUser(null);
  }, []);

  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAdmin,
        signInWithGoogle,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
