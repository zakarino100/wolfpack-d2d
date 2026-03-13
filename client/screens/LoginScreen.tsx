import React from "react";
import { View, StyleSheet, Image, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  FadeIn,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";

const logo = require("../../assets/images/logo.png");

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function LoginScreen() {
  const { theme } = useTheme();
  const { signInWithGoogle, isLoading } = useAuth();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSequence(
      withSpring(0.95, { damping: 10, stiffness: 200 }),
      withSpring(1, { damping: 10, stiffness: 200 })
    );
    await signInWithGoogle();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <Animated.View entering={FadeIn.delay(200).duration(600)} style={styles.logoContainer}>
        <Image source={logo} style={styles.logoImage} resizeMode="contain" />
        <ThemedText type="h2" style={styles.appName}>
          Healthy Home
        </ThemedText>
        <ThemedText type="body" style={styles.subtitle}>
          Door-to-Door Canvassing
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(400).duration(600)} style={styles.content}>
        <AnimatedPressable
          onPress={handlePress}
          disabled={isLoading}
          style={[
            styles.googleButton,
            { backgroundColor: "#fff", opacity: isLoading ? 0.7 : 1 },
            animatedStyle,
            Shadows.lg,
          ]}
        >
          <Image
            source={{ uri: "https://www.google.com/favicon.ico" }}
            style={styles.googleIcon}
          />
          <ThemedText type="button" style={{ color: "#1C1C1E" }}>
            {isLoading ? "Signing in..." : "Sign in with Google"}
          </ThemedText>
        </AnimatedPressable>

        <ThemedText type="small" style={styles.footer}>
          Field sales reps only. Contact admin for access.
        </ThemedText>
      </Animated.View>

      <View style={styles.decoration}>
        <Feather name="map-pin" size={200} color="rgba(255,255,255,0.1)" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: Spacing["2xl"],
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing["5xl"],
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 24,
    marginBottom: Spacing.lg,
  },
  appName: {
    color: "#fff",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: "rgba(255,255,255,0.8)",
  },
  content: {
    alignItems: "center",
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing["2xl"],
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    width: "100%",
    maxWidth: 300,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  footer: {
    color: "rgba(255,255,255,0.6)",
    marginTop: Spacing.xl,
    textAlign: "center",
  },
  decoration: {
    position: "absolute",
    bottom: -50,
    right: -50,
    opacity: 0.5,
  },
});
