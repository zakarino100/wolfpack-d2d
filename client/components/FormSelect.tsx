import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";

interface FormSelectProps<T extends string> {
  label?: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  error?: string;
}

export function FormSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
}: FormSelectProps<T>) {
  const { theme } = useTheme();
  const selectedOption = options.find((o) => o.value === value);

  return (
    <View style={styles.container}>
      {label ? (
        <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
          {label}
        </ThemedText>
      ) : null}
      <View style={styles.options}>
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[
                styles.option,
                {
                  backgroundColor: isSelected ? theme.primary : theme.backgroundDefault,
                  borderColor: isSelected ? theme.primary : theme.borderLight,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{
                  color: isSelected ? "#fff" : theme.text,
                  fontWeight: isSelected ? "600" : "400",
                }}
              >
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
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
    marginBottom: Spacing.sm,
    fontWeight: "500",
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  option: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
});
