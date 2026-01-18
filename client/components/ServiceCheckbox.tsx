import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { Service } from "@/types";

interface ServiceCheckboxProps {
  services: Service[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function ServiceCheckbox({
  services,
  selected,
  onChange,
}: ServiceCheckboxProps) {
  const { theme } = useTheme();

  const toggleService = (key: string) => {
    Haptics.selectionAsync();
    if (selected.includes(key)) {
      onChange(selected.filter((s) => s !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  return (
    <View style={styles.container}>
      <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
        Services Interested
      </ThemedText>
      <View style={styles.grid}>
        {services.map((service) => {
          const isSelected = selected.includes(service.key);
          return (
            <Pressable
              key={service.key}
              onPress={() => toggleService(service.key)}
              style={[
                styles.checkbox,
                {
                  backgroundColor: isSelected
                    ? `${theme.primary}15`
                    : theme.backgroundDefault,
                  borderColor: isSelected ? theme.primary : theme.borderLight,
                },
              ]}
            >
              <View
                style={[
                  styles.checkIcon,
                  {
                    backgroundColor: isSelected ? theme.primary : "transparent",
                    borderColor: isSelected ? theme.primary : theme.border,
                  },
                ]}
              >
                {isSelected ? (
                  <Feather name="check" size={12} color="#fff" />
                ) : null}
              </View>
              <ThemedText
                type="small"
                style={{ color: isSelected ? theme.primary : theme.text }}
              >
                {service.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  checkbox: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  checkIcon: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
