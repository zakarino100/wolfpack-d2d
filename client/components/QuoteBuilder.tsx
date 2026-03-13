import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
} from "react-native";
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

interface PricingTier {
  label: string;
  range: string;
  price: number;
}

const PROMOTION_PRICING: Record<string, PricingTier[]> = {
  "House Wash": [
    { label: "Under 2,000 sqft", range: "< 2,000 sqft", price: 149 },
    { label: "2,000 – 2,999 sqft", range: "2,000–2,999 sqft", price: 199 },
    { label: "3,000 – 3,999 sqft", range: "3,000–3,999 sqft", price: 299 },
    { label: "4,000 – 4,999 sqft", range: "4,000–4,999 sqft", price: 399 },
    { label: "5,000 – 5,999 sqft", range: "5,000–5,999 sqft", price: 499 },
    { label: "6,000 – 6,999 sqft", range: "6,000–6,999 sqft", price: 599 },
    { label: "7,000+ sqft", range: "7,000+ sqft", price: 699 },
  ],
  "Cement Cleaning": [
    { label: "Under 500 sqft", range: "< 500 sqft", price: 99 },
    { label: "500 – 999 sqft", range: "500–999 sqft", price: 149 },
    { label: "1,000 – 1,499 sqft", range: "1,000–1,499 sqft", price: 199 },
    { label: "1,500 – 1,999 sqft", range: "1,500–1,999 sqft", price: 249 },
    { label: "2,000 – 2,999 sqft", range: "2,000–2,999 sqft", price: 299 },
    { label: "3,000 – 3,999 sqft", range: "3,000–3,999 sqft", price: 349 },
    { label: "4,000+ sqft", range: "4,000+ sqft", price: 399 },
  ],
  "Roof Wash": [
    { label: "Under 1,500 sqft", range: "< 1,500 sqft", price: 249 },
    { label: "1,500 – 1,999 sqft", range: "1,500–1,999 sqft", price: 299 },
    { label: "2,000 – 2,499 sqft", range: "2,000–2,499 sqft", price: 349 },
    { label: "2,500 – 2,999 sqft", range: "2,500–2,999 sqft", price: 399 },
    { label: "3,000 – 3,499 sqft", range: "3,000–3,499 sqft", price: 449 },
    { label: "3,500 – 3,999 sqft", range: "3,500–3,999 sqft", price: 499 },
    { label: "4,000+ sqft", range: "4,000+ sqft", price: 549 },
  ],
  "Gutter Cleaning": [
    { label: "Up to 100 LF", range: "≤ 100 LF", price: 149 },
    { label: "100 – 149 LF", range: "100–149 LF", price: 199 },
    { label: "150 – 199 LF", range: "150–199 LF", price: 249 },
    { label: "200+ LF", range: "200+ LF", price: 299 },
  ],
  "Window Cleaning": [
    { label: "Up to 10 windows", range: "1–10 windows", price: 99 },
    { label: "11 – 20 windows", range: "11–20 windows", price: 149 },
    { label: "21 – 30 windows", range: "21–30 windows", price: 199 },
    { label: "31 – 40 windows", range: "31–40 windows", price: 249 },
    { label: "41+ windows", range: "41+ windows", price: 299 },
  ],
  "Deck Staining": [
    { label: "Under 200 sqft", range: "< 200 sqft", price: 299 },
    { label: "200 – 299 sqft", range: "200–299 sqft", price: 399 },
    { label: "300 – 399 sqft", range: "300–399 sqft", price: 499 },
    { label: "400+ sqft", range: "400+ sqft", price: 599 },
  ],
  "Driveway Sealing": [
    { label: "Under 500 sqft", range: "< 500 sqft", price: 149 },
    { label: "500 – 799 sqft", range: "500–799 sqft", price: 199 },
    { label: "800 – 1,099 sqft", range: "800–1,099 sqft", price: 249 },
    { label: "1,100+ sqft", range: "1,100+ sqft", price: 299 },
  ],
  "Holiday Lighting": [
    { label: "Standard Package", range: "Standard", price: 299 },
    { label: "Premium Package", range: "Premium", price: 499 },
    { label: "Deluxe Package", range: "Deluxe", price: 799 },
  ],
  Other: [
    { label: "Small Job", range: "Small", price: 99 },
    { label: "Medium Job", range: "Medium", price: 199 },
    { label: "Large Job", range: "Large", price: 299 },
    { label: "Custom Price", range: "Custom", price: 0 },
  ],
};

const PROMOTION_NAMES = Object.keys(PROMOTION_PRICING);

function SelectSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (val: string) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.backgroundDefault }]}>
        <View style={[styles.sheetHandle, { backgroundColor: theme.borderLight }]} />
        <ThemedText type="h4" style={styles.sheetTitle}>{title}</ThemedText>
        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          {options.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => { onSelect(opt); onClose(); }}
              style={[
                styles.sheetOption,
                selected === opt && { backgroundColor: theme.primary + "18" },
              ]}
            >
              <ThemedText
                type="body"
                style={selected === opt ? { color: theme.primary, fontWeight: "600" } : {}}
              >
                {opt}
              </ThemedText>
              {selected === opt ? (
                <Feather name="check" size={16} color={theme.primary} />
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function QuoteBuilder({ services, lineItems, onChange }: QuoteBuilderProps) {
  const { theme } = useTheme();
  const [selectedPromotion, setSelectedPromotion] = useState("");
  const [selectedTierIndex, setSelectedTierIndex] = useState(-1);
  const [customPrice, setCustomPrice] = useState("");
  const [showPromoSheet, setShowPromoSheet] = useState(false);
  const [showTierSheet, setShowTierSheet] = useState(false);

  const total = lineItems.reduce((sum, item) => sum + item.price, 0);

  const tiers = selectedPromotion ? PROMOTION_PRICING[selectedPromotion] ?? [] : [];
  const selectedTier = selectedTierIndex >= 0 ? tiers[selectedTierIndex] : null;

  const displayPrice = customPrice !== ""
    ? customPrice
    : selectedTier
    ? String(selectedTier.price)
    : "";

  const handlePromotionSelect = (promo: string) => {
    setSelectedPromotion(promo);
    setSelectedTierIndex(-1);
    setCustomPrice("");
  };

  const handleTierSelect = (label: string) => {
    const idx = tiers.findIndex((t) => t.label === label);
    setSelectedTierIndex(idx);
    setCustomPrice("");
  };

  const handleAddItem = () => {
    if (!selectedPromotion || !selectedTier) return;
    const price = customPrice !== "" ? parseFloat(customPrice) || 0 : selectedTier.price;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange([
      ...lineItems,
      {
        service: selectedPromotion,
        price,
        sqft: selectedTier.range,
        notes: "",
      },
    ]);
    setSelectedPromotion("");
    setSelectedTierIndex(-1);
    setCustomPrice("");
  };

  const removeItem = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(lineItems.filter((_, i) => i !== index));
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const tierLabels = tiers.map((t) => t.label);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="h4">Quote Builder</ThemedText>
        {total > 0 ? (
          <ThemedText type="h4" style={{ color: theme.statusSold }}>
            {formatCurrency(total)}
          </ThemedText>
        ) : null}
      </View>

      {lineItems.map((item, index) => (
        <View
          key={index}
          style={[styles.lineItem, { backgroundColor: theme.backgroundDefault }]}
        >
          <View style={{ flex: 1 }}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>{item.service}</ThemedText>
            {item.sqft ? (
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{item.sqft}</ThemedText>
            ) : null}
          </View>
          <ThemedText type="body" style={{ fontWeight: "700", color: theme.primary }}>
            {formatCurrency(item.price)}
          </ThemedText>
          <Pressable onPress={() => removeItem(index)} style={styles.removeBtn}>
            <Feather name="x" size={18} color={theme.error} />
          </Pressable>
        </View>
      ))}

      <View style={[styles.addForm, { backgroundColor: theme.backgroundDefault }]}>
        <Pressable
          onPress={() => setShowPromoSheet(true)}
          style={[styles.selectRow, { borderColor: theme.borderLight }]}
        >
          <ThemedText
            type="body"
            style={selectedPromotion ? { color: theme.text } : { color: theme.textSecondary }}
          >
            {selectedPromotion || "Select promotion..."}
          </ThemedText>
          <Feather name="chevron-down" size={16} color={theme.textSecondary} />
        </Pressable>

        {selectedPromotion ? (
          <Pressable
            onPress={() => setShowTierSheet(true)}
            style={[styles.selectRow, { borderColor: theme.borderLight, marginTop: Spacing.sm }]}
          >
            <ThemedText
              type="body"
              style={selectedTier ? { color: theme.text } : { color: theme.textSecondary }}
            >
              {selectedTier ? selectedTier.label : "Select size / range..."}
            </ThemedText>
            <Feather name="chevron-down" size={16} color={theme.textSecondary} />
          </Pressable>
        ) : null}

        {selectedTier ? (
          <View style={styles.priceRow}>
            <View style={styles.priceLabel}>
              <Feather name="tag" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                Price
              </ThemedText>
            </View>
            <View style={[styles.priceInputWrap, { borderColor: theme.primary }]}>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>$</ThemedText>
              <TextInput
                value={displayPrice}
                onChangeText={(v) => setCustomPrice(v.replace(/[^0-9.]/g, ""))}
                keyboardType="numeric"
                style={[styles.priceInput, { color: theme.text }]}
                selectTextOnFocus
              />
            </View>
            <Pressable
              onPress={handleAddItem}
              style={[styles.addBtn, { backgroundColor: theme.primary }]}
            >
              <Feather name="plus" size={16} color="#fff" />
              <ThemedText type="small" style={{ color: "#fff", fontWeight: "600" }}>
                Add
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
      </View>

      <SelectSheet
        visible={showPromoSheet}
        title="Select Promotion"
        options={PROMOTION_NAMES}
        selected={selectedPromotion}
        onSelect={handlePromotionSelect}
        onClose={() => setShowPromoSheet(false)}
      />
      <SelectSheet
        visible={showTierSheet}
        title="Select Size / Range"
        options={tierLabels}
        selected={selectedTier?.label ?? ""}
        onSelect={handleTierSelect}
        onClose={() => setShowTierSheet(false)}
      />
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
    gap: Spacing.sm,
  },
  removeBtn: {
    padding: Spacing.xs,
  },
  addForm: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  priceLabel: {
    flexDirection: "row",
    alignItems: "center",
  },
  priceInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm - 2,
    gap: 2,
  },
  priceInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    padding: 0,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: Spacing.sm,
    paddingBottom: 40,
    maxHeight: "65%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sheetScroll: {
    paddingHorizontal: Spacing.md,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: 2,
  },
});
