import React from "react";
import { View, TextInput, StyleSheet, TextInputProps } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";

interface FormInputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function FormInput({ label, error, style, ...props }: FormInputProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {label ? (
        <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundDefault,
            color: theme.text,
            borderColor: error ? theme.error : theme.borderLight,
          },
          style,
        ]}
        {...props}
      />
      {error ? (
        <ThemedText type="small" style={{ color: theme.error, marginTop: 4 }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    marginBottom: Spacing.xs,
    fontWeight: "500",
  },
  input: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    fontSize: 16,
  },
});
