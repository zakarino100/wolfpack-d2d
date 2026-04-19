import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { getTechUser } from "@/lib/techStorage";
import * as Location from "expo-location";

interface ClockSession {
  id: number;
  user_id: number;
  clocked_in_at: string;
  clocked_out_at: string | null;
  total_minutes: number | null;
}

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function TechClockScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sessions, setSessions] = useState<ClockSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = (from: Date) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - from.getTime());
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setElapsed(0);
  };

  const startPinging = () => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(async () => {
      try {
        const user = await getTechUser();
        if (!user) return;
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await fetch(`${getApiUrl()}api/tech/location`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
          body: JSON.stringify({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            accuracy: Math.round(loc.coords.accuracy ?? 0),
            heading: loc.coords.heading ? Math.round(loc.coords.heading) : null,
            speed: loc.coords.speed ? Number(loc.coords.speed.toFixed(2)) : null,
            context: "clocked_in",
          }),
        });
      } catch { /* silent */ }
    }, 60000);
  };

  const stopPinging = () => {
    if (pingIntervalRef.current) { clearInterval(pingIntervalRef.current); pingIntervalRef.current = null; }
  };

  const loadStatus = async () => {
    const user = await getTechUser();
    if (!user) return;
    try {
      const [statusRes, sessionsRes] = await Promise.all([
        fetch(`${getApiUrl()}api/tech/clock/status`, { headers: { Authorization: `Bearer ${user.token}` } }),
        fetch(`${getApiUrl()}api/tech/clock/sessions`, { headers: { Authorization: `Bearer ${user.token}` } }),
      ]);
      const statusData = await statusRes.json();
      const sessionsData = await sessionsRes.json();
      setSessions(sessionsData.sessions ?? []);

      if (statusData.clockedIn && statusData.session) {
        const from = new Date(statusData.session.clocked_in_at);
        setClockedIn(true);
        setClockInTime(from);
        setElapsed(Date.now() - from.getTime());
        startTimer(from);
        startPinging();
      }
    } catch { /* ignore */ }
    setInitializing(false);
  };

  useEffect(() => {
    loadStatus();
    return () => { stopTimer(); stopPinging(); };
  }, []);

  const handleClockIn = async () => {
    const user = await getTechUser();
    if (!user) return;
    setLoading(true);
    try {
      await Location.requestForegroundPermissionsAsync();
      const res = await fetch(`${getApiUrl()}api/tech/clock/in`, {
        method: "POST",
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (res.ok) {
        const now = new Date();
        setClockedIn(true);
        setClockInTime(now);
        startTimer(now);
        startPinging();
        await loadStatus();
      }
    } finally { setLoading(false); }
  };

  const handleClockOut = async () => {
    const user = await getTechUser();
    if (!user) return;
    setLoading(true);
    try {
      await fetch(`${getApiUrl()}api/tech/clock/out`, {
        method: "POST",
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setClockedIn(false);
      setClockInTime(null);
      stopTimer();
      stopPinging();
      await loadStatus();
    } finally { setLoading(false); }
  };

  if (initializing) return <ThemedView style={{ flex: 1 }}><ActivityIndicator style={{ flex: 1 }} color={theme.primary} /></ThemedView>;

  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList
        data={sessions}
        keyExtractor={s => String(s.id)}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 100 }}
        ListHeaderComponent={
          <>
            <ThemedText type="h3" style={{ marginBottom: Spacing.xl }}>Clock</ThemedText>

            {/* Big clock in/out button */}
            <View style={styles.clockCard}>
              <View style={[styles.statusDot, { backgroundColor: clockedIn ? theme.success : theme.border }]} />
              <ThemedText type="h4" style={{ color: clockedIn ? theme.success : theme.textSecondary }}>
                {clockedIn ? "Clocked In" : "Clocked Out"}
              </ThemedText>

              {clockedIn && (
                <ThemedText type="h1" style={{ marginVertical: Spacing.md, fontVariant: ["tabular-nums"] }}>
                  {formatDuration(elapsed)}
                </ThemedText>
              )}

              <Pressable
                onPress={clockedIn ? handleClockOut : handleClockIn}
                disabled={loading}
                style={[
                  styles.clockBtn,
                  { backgroundColor: clockedIn ? theme.error : theme.success },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name={clockedIn ? "log-out" : "log-in"} size={20} color="#fff" />
                    <ThemedText type="body" style={{ color: "#fff", fontWeight: "700", marginLeft: 8 }}>
                      {clockedIn ? "Clock Out" : "Clock In"}
                    </ThemedText>
                  </>
                )}
              </Pressable>
            </View>

            <ThemedText type="h4" style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}>
              Today's Sessions
            </ThemedText>
          </>
        }
        renderItem={({ item }) => {
          const inTime = new Date(item.clocked_in_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          const outTime = item.clocked_out_at
            ? new Date(item.clocked_out_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
            : "Active";
          const mins = item.total_minutes;
          return (
            <Card elevation={0} style={styles.sessionCard}>
              <View style={styles.sessionRow}>
                <ThemedText type="body">{inTime} → {outTime}</ThemedText>
                {mins != null && (
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {Math.floor(mins / 60)}h {mins % 60}m
                  </ThemedText>
                )}
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          <ThemedText type="small" style={{ color: theme.textSecondary }}>No sessions today yet.</ThemedText>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  clockCard: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  clockBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  sessionCard: {
    marginBottom: Spacing.sm,
  },
  sessionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
