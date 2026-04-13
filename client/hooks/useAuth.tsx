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
import { setUnauthorizedHandler } from "@/lib/authEvents";

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
      
      // Parse token from URL - handle both standard and exp:// URLs
      let token: string | null = null;
      let error: string | null = null;
      
      try {
        // Try extracting from query string directly
        const queryMatch = event.url.match(/[?&]token=([^&]+)/);
        if (queryMatch) {
          token = decodeURIComponent(queryMatch[1]);
        }
        const errorMatch = event.url.match(/[?&]error=([^&]+)/);
        if (errorMatch) {
          error = decodeURIComponent(errorMatch[1]);
        }
      } catch (e) {
        console.error("Failed to parse deep link URL:", e);
      }
      
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
      const baseUrl = getApiUrl();
      // Use portless URL for redirect detection (Replit proxy strips ports)
      const baseUrlObj = new URL(baseUrl);
      const portlessBaseUrl = `${baseUrlObj.protocol}//${baseUrlObj.hostname}/`;
      const redirectUrl = `${portlessBaseUrl}auth/callback`;
      console.log("Expected redirect URL:", redirectUrl);
      
      // But send the full URL with port to the server so it can redirect correctly
      const serverRedirectUrl = `${baseUrl}auth/callback`;
      const authUrl = `${baseUrl}api/auth/google?app_redirect_uri=${encodeURIComponent(serverRedirectUrl)}`;
      console.log("Auth URL:", authUrl);
      
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      console.log("Auth session result:", result.type);
      
      if (result.type === "success" && result.url) {
        // Extract token from the returned URL
        const tokenMatch = result.url.match(/[?&]token=([^&]+)/);
        if (tokenMatch) {
          const token = decodeURIComponent(tokenMatch[1]);
          console.log("Token extracted from auth session");
          await setAuthToken(token);
          await refreshUser();
          return;
        }
      }
      
      // If session detection didn't work (cancel/dismiss), try refreshing anyway
      console.log("Trying to refresh user after browser closed...");
      await refreshUser();
    } catch (error) {
      console.error("Google sign in failed:", error);
    }
  }, [refreshUser]);

  const signOut = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {
      console.error("Logout request failed");
    }
    await clearAllStorage();
    setUser(null);
  }, []);

  // Wire global 401 handler so expired tokens auto-logout
  useEffect(() => {
    setUnauthorizedHandler(signOut);
  }, [signOut]);

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
