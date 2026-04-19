import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { setTechUser } from "@/lib/techStorage";
import type { TechUser } from "@/types";

interface TechOption {
  id: number;
  name: string;
}

export default function TechLoginScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [techs, setTechs] = useState<TechOption[]>([]);
  const [selectedTech, setSelectedTech] = useState<TechOption | null>(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingTechs, setLoadingTechs] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${getApiUrl()}api/tech/technicians`);
        const data = await res.json();
        setTechs(Array.isArray(data) ? data : []);
      } catch {
        // ignore
      } finally {
        setLoadingTechs(false);
      }
    })();
  }, []);

  const handleDigit = (d: string) => {
    if (pin.length < 4) setPin(p => p + d);
  };

  const handleBackspace = () => setPin(p => p.slice(0, -1));

  const handleLogin = async () => {
    if (!selectedTech) return Alert.alert("Select your name first");
    if (pin.length < 4) return Alert.alert("Enter your 4-digit PIN");

    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}api/tech/auth/pin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedTech.id, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");

      const techUser: TechUser = {
        id: data.user.id,
        name: data.user.name,
        role: data.user.role,
        skills: data.user.skills ?? [],
        pay_cut_pct: Number(data.user.pay_cut_pct ?? 25),
        token: data.token,
      };
      await setTechUser(techUser);
      navigation.replace("TechMain");
    } catch (err: any) {
      Alert.alert("Login Failed", err.message ?? "Invalid PIN");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.back}>
        <Feather name="arrow-left" size={22} color={theme.text} />
      </Pressable>

      <ThemedText type="h2" style={styles.title}>Technician Login</ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginBottom: Spacing.xl }}>
        Select your name, then enter your PIN
      </ThemedText>

      {/* Name selector */}
      {loadingTechs ? (
        <ActivityIndicator color={theme.primary} style={{ marginBottom: Spacing.xl }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.techList}>
          {techs.map(t => (
            <Pressable
              key={t.id}
              onPress={() => setSelectedTech(t)}
              style={[
                styles.techChip,
                {
                  backgroundColor: selectedTech?.id === t.id ? theme.primary : theme.backgroundSecondary,
                  borderColor: selectedTech?.id === t.id ? theme.primary : theme.border,
                },
              ]}
            >
              <ThemedText
                type="body"
                style={{ color: selectedTech?.id === t.id ? "#fff" : theme.text, fontWeight: "600" }}
              >
                {t.name}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* PIN dots */}
      <View style={styles.pinDots}>
        {[0, 1, 2, 3].map(i => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i < pin.length ? theme.primary : theme.border },
            ]}
          />
        ))}
      </View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {DIGITS.map((d, idx) => (
          <Pressable
            key={idx}
            onPress={() => d === "⌫" ? handleBackspace() : d ? handleDigit(d) : null}
            disabled={!d}
            style={({ pressed }) => [
              styles.key,
              {
                backgroundColor: d ? (pressed ? theme.backgroundSecondary : theme.backgroundRoot) : "transparent",
                borderColor: d ? theme.border : "transparent",
                opacity: d ? 1 : 0,
              },
              Shadows.sm,
            ]}
          >
            <ThemedText type="h3" style={{ color: d === "⌫" ? theme.textSecondary : theme.text }}>
              {d}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={handleLogin}
        disabled={loading || pin.length < 4 || !selectedTech}
        style={[
          styles.loginBtn,
          {
            backgroundColor:
              loading || pin.length < 4 || !selectedTech
                ? theme.backgroundSecondary
                : theme.primary,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText type="body" style={{ color: "#fff", fontWeight: "700" }}>
            Sign In
          </ThemedText>
        )}
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", paddingHorizontal: Spacing.xl },
  back: { position: "absolute", top: 56, left: Spacing.lg },
  title: { marginBottom: Spacing.sm },
  techList: { marginBottom: Spacing.xl, flexGrow: 0 },
  techChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    marginRight: Spacing.sm,
  },
  pinDots: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  dot: { width: 18, height: 18, borderRadius: 9 },
  keypad: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 280,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    justifyContent: "center",
  },
  key: {
    width: 80,
    height: 64,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loginBtn: {
    width: 280,
    height: 52,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
});
