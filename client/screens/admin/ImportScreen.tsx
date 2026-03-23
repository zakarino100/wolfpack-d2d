import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/query-client";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { BorderRadius, Spacing } from "@/constants/theme";

interface ImportReport {
  total: number;
  skippedBotRows: number;
  skippedBlankRows: number;
  skippedNoAddress: number;
  duplicates: Array<{ rowIndex: number; name: string; address: string; existingId: string }>;
  geocodingFailures: Array<{ rowIndex: number; address: string; reason: string }>;
  parseIssues: Array<{ rowIndex: number; field: string; raw: string; issue: string }>;
  toInsert: number;
  insertedIds: string[];
  dryRun: boolean;
  errors: string[];
}

export default function ImportScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const [report, setReport] = useState<ImportReport | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [phase, setPhase] = useState<"idle" | "dry-run" | "importing" | "done">("idle");
  const [confirmVisible, setConfirmVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const runMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const url = new URL(
        dryRun ? "/api/admin/import/dry-run" : "/api/admin/import/run",
        getApiUrl()
      ).toString();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ report: ImportReport; logs: string[] }>;
    },
    onSuccess: (data, dryRun) => {
      setReport(data.report);
      setLogs(data.logs);
      setPhase("done");
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    },
  });

  const handleDryRun = () => {
    setPhase("dry-run");
    setReport(null);
    setLogs([]);
    runMutation.mutate(true);
  };

  const handleRealImport = () => {
    setPhase("importing");
    setReport(null);
    setLogs([]);
    runMutation.mutate(false);
  };

  const handleConfirmImport = () => {
    setConfirmVisible(false);
    handleRealImport();
  };

  const isLoading = runMutation.isPending;

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header info card */}
        <Card elevation={1} style={styles.infoCard}>
          <View style={styles.infoIconRow}>
            <View style={[styles.iconCircle, { backgroundColor: `${theme.primary}20` }]}>
              <Feather name="archive" size={24} color={theme.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <ThemedText type="h3">Wolf Pack Wash Historical Import</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                308 records from Airtable (Feb–Aug 2025)
              </ThemedText>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.metaRow}>
            <MetaChip icon="database" label="Source" value="Airtable CSV" theme={theme} />
            <MetaChip icon="tag" label="Batch" value="airtable-wpw-2025" theme={theme} />
          </View>
          <View style={[styles.metaRow, { marginTop: Spacing.sm }]}>
            <MetaChip icon="map-pin" label="Pin Color" value="Crimson #C0121A" theme={theme} color="#C0121A" />
            <MetaChip icon="shield" label="Mode" value="Non-destructive" theme={theme} color={theme.success} />
          </View>

          <View style={[styles.ruleBox, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}30` }]}>
            <Feather name="info" size={14} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.xs, flex: 1 }}>
              All imported records are tagged is_historical_import = true and will never overwrite existing leads. Run a dry run first to preview the results before committing.
            </ThemedText>
          </View>
        </Card>

        {/* Action buttons */}
        <Card elevation={1} style={styles.actionsCard}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>Import Actions</ThemedText>

          <Button
            onPress={handleDryRun}
            disabled={isLoading}
            style={[styles.btn, { backgroundColor: theme.backgroundSecondary }]}
          >
            {isLoading && phase === "dry-run" ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <View style={styles.btnInner}>
                <Feather name="eye" size={16} color={theme.primary} />
                <ThemedText type="body" style={{ color: theme.primary, fontWeight: "700", marginLeft: Spacing.xs }}>
                  Run Dry Run
                </ThemedText>
              </View>
            )}
          </Button>

          <ThemedText type="small" style={[styles.btnHint, { color: theme.textSecondary }]}>
            Parses, geocodes, and checks for duplicates — zero database writes
          </ThemedText>

          <Button
            onPress={() => setConfirmVisible(true)}
            disabled={isLoading}
            style={[styles.btn, { backgroundColor: "#C0121A", marginTop: Spacing.md }]}
          >
            {isLoading && phase === "importing" ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.btnInner}>
                <Feather name="upload-cloud" size={16} color="#fff" />
                <ThemedText type="body" style={{ color: "#fff", fontWeight: "700", marginLeft: Spacing.xs }}>
                  Run Real Import
                </ThemedText>
              </View>
            )}
          </Button>

          <ThemedText type="small" style={[styles.btnHint, { color: theme.textSecondary }]}>
            Inserts all non-duplicate leads and creates map pins. Idempotent — safe to re-run.
          </ThemedText>
        </Card>

        {/* Loading state */}
        {isLoading ? (
          <Card elevation={1} style={styles.loadingCard}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary, textAlign: "center" }}>
              {phase === "dry-run" ? "Running dry run — geocoding addresses..." : "Importing leads and creating pins..."}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: 4 }}>
              This may take 1–2 minutes (geocoding 300 addresses)
            </ThemedText>
          </Card>
        ) : null}

        {/* Results */}
        {report && !isLoading ? (
          <>
            <Card elevation={1} style={styles.resultsCard}>
              <View style={styles.resultBadgeRow}>
                <View style={[styles.resultBadge, { backgroundColor: report.dryRun ? `${theme.primary}20` : "#C0121A20" }]}>
                  <Feather name={report.dryRun ? "eye" : "check-circle"} size={14} color={report.dryRun ? theme.primary : "#C0121A"} />
                  <ThemedText type="small" style={{ color: report.dryRun ? theme.primary : "#C0121A", marginLeft: 4, fontWeight: "700" }}>
                    {report.dryRun ? "DRY RUN RESULTS" : "IMPORT COMPLETE"}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.statGrid}>
                <StatBox label="Total Rows" value={report.total} color={theme.text} theme={theme} />
                <StatBox label="To Insert" value={report.toInsert} color={theme.success} theme={theme} />
                <StatBox label="Duplicates" value={report.duplicates.length} color={theme.warning ?? "#F59E0B"} theme={theme} />
                <StatBox label="Bot Rows" value={report.skippedBotRows} color={theme.textSecondary} theme={theme} />
                <StatBox label="No Address" value={report.skippedNoAddress} color={theme.textSecondary} theme={theme} />
                <StatBox label="Geo Fails" value={report.geocodingFailures.length} color={report.geocodingFailures.length > 0 ? "#C0121A" : theme.textSecondary} theme={theme} />
              </View>

              {!report.dryRun ? (
                <View style={[styles.successBanner, { backgroundColor: `${theme.success}15` }]}>
                  <Feather name="check-circle" size={16} color={theme.success} />
                  <ThemedText type="body" style={{ color: theme.success, marginLeft: Spacing.sm, fontWeight: "700" }}>
                    {report.insertedIds.length} leads inserted successfully
                  </ThemedText>
                </View>
              ) : null}

              {report.errors.length > 0 ? (
                <View style={[styles.errorBox, { backgroundColor: "#C0121A15", borderColor: "#C0121A40" }]}>
                  <ThemedText type="small" style={{ color: "#C0121A", fontWeight: "700", marginBottom: 4 }}>
                    Errors ({report.errors.length})
                  </ThemedText>
                  {report.errors.map((e, i) => (
                    <ThemedText key={i} type="small" style={{ color: "#C0121A" }}>{e}</ThemedText>
                  ))}
                </View>
              ) : null}
            </Card>

            {/* Geocoding failures */}
            {report.geocodingFailures.length > 0 ? (
              <Card elevation={1} style={styles.issueCard}>
                <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
                  Geocoding Failures ({report.geocodingFailures.length})
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
                  These leads were still imported but have no map coordinates.
                </ThemedText>
                {report.geocodingFailures.slice(0, 10).map((f, i) => (
                  <View key={i} style={[styles.issueRow, { borderColor: theme.border }]}>
                    <ThemedText type="small" style={{ fontWeight: "600" }}>Row {f.rowIndex}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1, marginLeft: Spacing.sm }} numberOfLines={2}>
                      {f.address}
                    </ThemedText>
                  </View>
                ))}
                {report.geocodingFailures.length > 10 ? (
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                    ... and {report.geocodingFailures.length - 10} more
                  </ThemedText>
                ) : null}
              </Card>
            ) : null}

            {/* Duplicates */}
            {report.duplicates.length > 0 ? (
              <Card elevation={1} style={styles.issueCard}>
                <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
                  Duplicates Skipped ({report.duplicates.length})
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
                  Matched existing leads by address + phone. Not inserted.
                </ThemedText>
                {report.duplicates.slice(0, 8).map((d, i) => (
                  <View key={i} style={[styles.issueRow, { borderColor: theme.border }]}>
                    <ThemedText type="small" style={{ fontWeight: "600", width: 60 }}>Row {d.rowIndex}</ThemedText>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="small">{d.name || "—"}</ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
                        {d.address}
                      </ThemedText>
                    </View>
                  </View>
                ))}
                {report.duplicates.length > 8 ? (
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                    ... and {report.duplicates.length - 8} more duplicates
                  </ThemedText>
                ) : null}
              </Card>
            ) : null}

            {/* Parse issues */}
            {report.parseIssues.length > 0 ? (
              <Card elevation={1} style={styles.issueCard}>
                <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
                  Parse Issues ({report.parseIssues.length})
                </ThemedText>
                {report.parseIssues.map((p, i) => (
                  <View key={i} style={[styles.issueRow, { borderColor: theme.border }]}>
                    <ThemedText type="small" style={{ fontWeight: "600", width: 60 }}>Row {p.rowIndex}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                      {p.field}: {p.issue} (raw: "{p.raw}")
                    </ThemedText>
                  </View>
                ))}
              </Card>
            ) : null}

            {/* Server logs */}
            {logs.length > 0 ? (
              <Card elevation={1} style={styles.logsCard}>
                <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Process Log</ThemedText>
                {logs.map((line, i) => (
                  <ThemedText key={i} type="small" style={{ color: theme.textSecondary, fontFamily: "monospace", marginBottom: 2 }}>
                    {line}
                  </ThemedText>
                ))}
              </Card>
            ) : null}
          </>
        ) : null}

        {/* Confirm modal replacement */}
        {confirmVisible ? (
          <View style={[styles.confirmOverlay, { backgroundColor: `${theme.backgroundRoot}F5` }]}>
            <Card elevation={3} style={styles.confirmCard}>
              <View style={[styles.iconCircle, { backgroundColor: "#C0121A20", alignSelf: "center", marginBottom: Spacing.lg }]}>
                <Feather name="alert-triangle" size={28} color="#C0121A" />
              </View>
              <ThemedText type="h3" style={{ textAlign: "center", marginBottom: Spacing.sm }}>
                Run Real Import?
              </ThemedText>
              <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginBottom: Spacing.xl }}>
                This will insert all non-duplicate leads from the Wolf Pack Wash CSV into the database and create map pins. Run a dry run first if you haven't already.
              </ThemedText>
              <Button
                onPress={handleConfirmImport}
                style={{ backgroundColor: "#C0121A", marginBottom: Spacing.md }}
              >
                <ThemedText type="body" style={{ color: "#fff", fontWeight: "700" }}>
                  Yes, Import Now
                </ThemedText>
              </Button>
              <Button
                onPress={() => setConfirmVisible(false)}
                style={{ backgroundColor: theme.backgroundSecondary }}
              >
                <ThemedText type="body" style={{ color: theme.text }}>Cancel</ThemedText>
              </Button>
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function MetaChip({ icon, label, value, theme, color }: any) {
  return (
    <View style={[styles.metaChip, { backgroundColor: theme.backgroundSecondary }]}>
      <Feather name={icon} size={12} color={color || theme.textSecondary} />
      <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
        {label}:{" "}
      </ThemedText>
      <ThemedText type="small" style={{ color: color || theme.text, fontWeight: "600" }}>
        {value}
      </ThemedText>
    </View>
  );
}

function StatBox({ label, value, color, theme }: any) {
  return (
    <View style={[styles.statBox, { backgroundColor: theme.backgroundSecondary }]}>
      <ThemedText type="h2" style={{ color, fontWeight: "800" }}>
        {value}
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  infoCard: {
    padding: Spacing.lg,
  },
  infoIconRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  metaRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    flex: 1,
  },
  ruleBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionsCard: {
    padding: Spacing.lg,
  },
  btn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  btnHint: {
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  loadingCard: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  resultsCard: {
    padding: Spacing.lg,
  },
  resultBadgeRow: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  resultBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statBox: {
    width: "30%",
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: "center",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  errorBox: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  issueCard: {
    padding: Spacing.lg,
  },
  issueRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  logsCard: {
    padding: Spacing.lg,
  },
  confirmOverlay: {
    position: "absolute",
    top: -Spacing.lg,
    left: -Spacing.md,
    right: -Spacing.md,
    bottom: -Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  confirmCard: {
    padding: Spacing.xl,
    margin: Spacing.xl,
    width: "90%",
  },
});
