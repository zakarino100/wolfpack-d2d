import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { Quote } from "@/types";

interface QuoteCardProps {
  quote: Quote;
}

export function QuoteCard({ quote }: QuoteCardProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const total =
    quote.quote_amount ||
    quote.quote_line_items.reduce((sum, item) => sum + item.price, 0);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundDefault, borderColor: theme.borderLight },
      ]}
    >
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="file-text" size={16} color={theme.statusQuoted} />
          <View>
            <ThemedText type="h4">{formatCurrency(total)}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {formatDate(quote.created_at)}
              {quote.offer_version ? ` - ${quote.offer_version}` : ""}
            </ThemedText>
          </View>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={theme.textSecondary}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.content}>
          {quote.quote_line_items.map((item, index) => (
            <View
              key={index}
              style={[styles.lineItem, { borderTopColor: theme.borderLight }]}
            >
              <ThemedText type="body">{item.service}</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {formatCurrency(item.price)}
              </ThemedText>
            </View>
          ))}

          {quote.proposed_timeframe ? (
            <View style={styles.infoRow}>
              <Feather name="clock" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {quote.proposed_timeframe}
              </ThemedText>
            </View>
          ) : null}

          {quote.notes ? (
            <ThemedText
              type="small"
              style={[styles.notes, { color: theme.textSecondary }]}
            >
              {quote.notes}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  lineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  notes: {
    marginTop: Spacing.sm,
    fontStyle: "italic",
  },
});
