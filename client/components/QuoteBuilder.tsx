import React, { useState } from "react";
import { View, StyleSheet, Pressable, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { QuoteLineItem, Service } from "@/types";

interface QuoteBuilderProps {
  services: Service[];
  lineItems: QuoteLineItem[];
  onChange: (items: QuoteLineItem[]) => void;
}

export function QuoteBuilder({
  services,
  lineItems,
  onChange,
}: QuoteBuilderProps) {
  const { theme } = useTheme();
  const [showAdd, setShowAdd] = useState(false);
  const [newService, setNewService] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const total = lineItems.reduce((sum, item) => sum + item.price, 0);

  const addItem = () => {
    if (!newService || !newPrice) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange([
      ...lineItems,
      {
        service: newService,
        price: parseFloat(newPrice) || 0,
        sqft: null,
        notes: "",
      },
    ]);
    setNewService("");
    setNewPrice("");
    setShowAdd(false);
  };

  const removeItem = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(lineItems.filter((_, i) => i !== index));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="h4">Quote Builder</ThemedText>
        {total > 0 ? (
          <ThemedText type="h4" style={{ color: theme.statusQuoted }}>
            {formatCurrency(total)}
          </ThemedText>
        ) : null}
      </View>

      {lineItems.map((item, index) => (
        <View
          key={index}
          style={[styles.lineItem, { backgroundColor: theme.backgroundDefault }]}
        >
          <View style={styles.lineItemContent}>
            <ThemedText type="body">{item.service}</ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {formatCurrency(item.price)}
            </ThemedText>
          </View>
          <Pressable onPress={() => removeItem(index)} style={styles.removeBtn}>
            <Feather name="x" size={18} color={theme.error} />
          </Pressable>
        </View>
      ))}

      {showAdd ? (
        <View style={[styles.addForm, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.addRow}>
            <TextInput
              value={newService}
              onChangeText={setNewService}
              placeholder="Service name"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, styles.serviceInput, { color: theme.text, borderColor: theme.borderLight }]}
            />
            <TextInput
              value={newPrice}
              onChangeText={setNewPrice}
              placeholder="$0"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              style={[styles.input, styles.priceInput, { color: theme.text, borderColor: theme.borderLight }]}
            />
          </View>
          <View style={styles.addActions}>
            <Pressable
              onPress={() => setShowAdd(false)}
              style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary }]}
            >
              <ThemedText type="small">Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={addItem}
              style={[styles.actionBtn, { backgroundColor: theme.primary }]}
            >
              <ThemedText type="small" style={{ color: "#fff" }}>
                Add
              </ThemedText>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setShowAdd(true)}
          style={[styles.addBtn, { borderColor: theme.primary }]}
        >
          <Feather name="plus" size={16} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.primary }}>
            Add Line Item
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  lineItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  lineItemContent: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  removeBtn: {
    marginLeft: Spacing.md,
    padding: Spacing.xs,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    gap: Spacing.sm,
  },
  addForm: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  addRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  input: {
    height: 40,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    fontSize: 15,
  },
  serviceInput: {
    flex: 2,
  },
  priceInput: {
    flex: 1,
  },
  addActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
  },
  actionBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
  },
});
