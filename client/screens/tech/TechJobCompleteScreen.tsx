import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { getTechUser } from "@/lib/techStorage";
import type { TechJob } from "@/types";

interface Props {
  route: { params: { job: TechJob } };
  navigation: any;
}

export default function TechJobCompleteScreen({ route, navigation }: Props) {
  const { job } = route.params;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [photos, setPhotos] = useState<{ uri: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [cutEarned, setCutEarned] = useState<string | null>(null);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Camera permission required"); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setPhotos(prev => [...prev, result.assets[0]]);
    }
  };

  const removePhoto = (idx: number) => setPhotos(prev => prev.filter((_, i) => i !== idx));

  const handleComplete = async () => {
    if (photos.length === 0) return;
    const user = await getTechUser();
    if (!user) return;

    setUploading(true);
    try {
      // Upload after photos
      for (const photo of photos) {
        const formData = new FormData();
        formData.append("photo_type", "after");
        formData.append("file", {
          uri: photo.uri,
          name: `after_${Date.now()}.jpg`,
          type: "image/jpeg",
        } as any);
        await fetch(`${getApiUrl()}api/jobs/${job.id}/photos`, {
          method: "POST",
          headers: { Authorization: `Bearer ${user.token}` },
          body: formData,
        });
      }

      // Mark complete
      await fetch(`${getApiUrl()}api/jobs/${job.id}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ completedAt: new Date().toISOString() }),
      });

      setCutEarned(job.techCut);
      setDone(true);
    } catch {
      Alert.alert("Error", "Something went wrong. Try again.");
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <ThemedView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <View style={[styles.successIcon, { backgroundColor: `${theme.success}20` }]}>
          <Feather name="check-circle" size={48} color={theme.success} />
        </View>
        <ThemedText type="h2" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}>Job Complete!</ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginBottom: Spacing.lg }}>
          {job.customerFirstName}'s job is done. Great work!
        </ThemedText>
        {cutEarned && (
          <Card elevation={1} style={{ padding: Spacing.lg, alignItems: "center", marginBottom: Spacing.xl }}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>You earned</ThemedText>
            <ThemedText type="h1" style={{ color: theme.success }}>${cutEarned}</ThemedText>
          </Card>
        )}
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.doneBtn, { backgroundColor: theme.primary }]}
        >
          <ThemedText type="body" style={{ color: "#fff", fontWeight: "700" }}>Back to Jobs</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Feather name="arrow-left" size={22} color={theme.text} />
          <ThemedText type="body" style={{ marginLeft: 8, color: theme.primary }}>Back</ThemedText>
        </Pressable>

        <ThemedText type="h2" style={{ marginBottom: Spacing.lg }}>Complete Job</ThemedText>

        <Card elevation={1} style={{ marginBottom: Spacing.xl }}>
          <ThemedText type="h4">{job.customerFirstName} {job.customerLastName}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {job.customerAddress}{job.customerCity ? `, ${job.customerCity}` : ""}
          </ThemedText>
          {job.techCut && (
            <ThemedText type="small" style={{ color: theme.success, fontWeight: "700", marginTop: 4 }}>
              You'll earn: ${job.techCut}
            </ThemedText>
          )}
        </Card>

        <ThemedText type="h4" style={{ marginBottom: Spacing.xs }}>
          After Photos <ThemedText type="small" style={{ color: theme.error }}>*required</ThemedText>
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
          Show the finished work before marking complete.
        </ThemedText>

        <View style={styles.photoGrid}>
          {photos.map((p, idx) => (
            <View key={idx} style={styles.photoThumb}>
              <Image source={{ uri: p.uri }} style={styles.thumb} />
              <Pressable onPress={() => removePhoto(idx)} style={[styles.removeBtn, { backgroundColor: theme.error }]}>
                <Feather name="x" size={12} color="#fff" />
              </Pressable>
            </View>
          ))}
          <Pressable onPress={takePhoto} style={[styles.addPhoto, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="camera" size={24} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>Add Photo</ThemedText>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.backgroundRoot }]}>
        <Pressable
          onPress={handleComplete}
          disabled={photos.length === 0 || uploading}
          style={[
            styles.completeBtn,
            { backgroundColor: photos.length === 0 ? theme.backgroundSecondary : theme.success },
          ]}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="check-circle" size={20} color="#fff" />
              <ThemedText type="body" style={{ color: "#fff", fontWeight: "700", marginLeft: 8 }}>
                Mark Complete ({photos.length} photo{photos.length !== 1 ? "s" : ""})
              </ThemedText>
            </>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.xl },
  scroll: { padding: Spacing.lg },
  back: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.lg },
  successIcon: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.xl },
  photoThumb: { position: "relative" },
  thumb: { width: 100, height: 100, borderRadius: 8 },
  removeBtn: {
    position: "absolute", top: 4, right: 4,
    width: 20, height: 20, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  addPhoto: {
    width: 100, height: 100, borderRadius: 8,
    borderWidth: 1.5, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
  },
  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: Spacing.lg,
    borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.08)",
  },
  completeBtn: {
    flexDirection: "row", height: 52, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  doneBtn: {
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderRadius: 12, alignItems: "center",
  },
});
