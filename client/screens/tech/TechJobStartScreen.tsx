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
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { getTechUser } from "@/lib/techStorage";
import type { TechJob } from "@/types";

interface Props {
  route: { params: { job: TechJob } };
  navigation: any;
}

export default function TechJobStartScreen({ route, navigation }: Props) {
  const { job } = route.params;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [photos, setPhotos] = useState<{ uri: string; base64?: string | null }[]>([]);
  const [uploading, setUploading] = useState(false);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera permission required");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos(prev => [...prev, result.assets[0]]);
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleBeginJob = async () => {
    if (photos.length === 0) return;
    const user = await getTechUser();
    if (!user) return;

    setUploading(true);
    try {
      // Upload all before photos
      for (const photo of photos) {
        const formData = new FormData();
        formData.append("photo_type", "before");
        formData.append("file", {
          uri: photo.uri,
          name: `before_${Date.now()}.jpg`,
          type: "image/jpeg",
        } as any);

        const res = await fetch(`${getApiUrl()}api/jobs/${job.id}/photos`, {
          method: "POST",
          headers: { Authorization: `Bearer ${user.token}` },
          body: formData,
        });
        if (!res.ok) console.warn("[TechJobStart] photo upload failed");
      }

      // Update job status to in_progress
      await fetch(`${getApiUrl()}api/jobs/${job.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ status: "in_progress" }),
      });

      Alert.alert("Job Started!", "Before photos saved. Go get it done 💪", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert("Error", "Something went wrong. Try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 100 }]}>
        {/* Back */}
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Feather name="arrow-left" size={22} color={theme.text} />
          <ThemedText type="body" style={{ marginLeft: 8, color: theme.primary }}>Back</ThemedText>
        </Pressable>

        <ThemedText type="h2" style={styles.title}>Start Job</ThemedText>

        {/* Job details */}
        <Card elevation={1} style={styles.card}>
          <ThemedText type="h4">{job.customerFirstName} {job.customerLastName}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {job.customerAddress}{job.customerCity ? `, ${job.customerCity}` : ""}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
            {job.serviceType}
          </ThemedText>
        </Card>

        {/* Before photos */}
        <ThemedText type="h4" style={styles.sectionLabel}>
          Before Photos <ThemedText type="small" style={{ color: theme.error }}>*required</ThemedText>
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
          Take at least one photo before starting work.
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

      {/* Begin Job button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.backgroundRoot }]}>
        <Pressable
          onPress={handleBeginJob}
          disabled={photos.length === 0 || uploading}
          style={[
            styles.beginBtn,
            { backgroundColor: photos.length === 0 ? theme.backgroundSecondary : theme.primary },
          ]}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="play-circle" size={20} color="#fff" />
              <ThemedText type="body" style={{ color: "#fff", fontWeight: "700", marginLeft: 8 }}>
                Begin Job ({photos.length} photo{photos.length !== 1 ? "s" : ""})
              </ThemedText>
            </>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg },
  back: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.lg },
  title: { marginBottom: Spacing.lg },
  card: { marginBottom: Spacing.xl },
  sectionLabel: { marginBottom: Spacing.xs },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.xl },
  photoThumb: { position: "relative" },
  thumb: { width: 100, height: 100, borderRadius: BorderRadius.md },
  removeBtn: {
    position: "absolute",
    top: 4, right: 4,
    width: 20, height: 20,
    borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  addPhoto: {
    width: 100, height: 100,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  beginBtn: {
    flexDirection: "row",
    height: 52,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
});
