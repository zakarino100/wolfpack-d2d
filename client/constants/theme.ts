import { Platform } from "react-native";

const brandPrimary = "#4A9B8E";
const brandDark = "#1B3A4B";

export const Colors = {
  light: {
    text: "#1C1C1E",
    textSecondary: "#8E8E93",
    buttonText: "#FFFFFF",
    tabIconDefault: "#8E8E93",
    tabIconSelected: brandPrimary,
    link: brandPrimary,
    primary: brandPrimary,
    secondary: brandDark,
    backgroundRoot: "#F7FAF9",
    backgroundDefault: "#FFFFFF",
    backgroundSecondary: "#EDF2F0",
    backgroundTertiary: "#D1D1D6",
    border: "#C6C6C8",
    borderLight: "#E5E5EA",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#007AFF",
    statusNotHome: "#9CA3AF",
    statusKnockedNoAnswer: "#9CA3AF",
    statusAnswered: "#60A5FA",
    statusInaccessible: "#6B7280",
    statusDoNotKnock: "#7F1D1D",
    statusNotInterested: "#EF4444",
    statusRevisitNeeded: "#F97316",
    statusFollowUp: "#F59E0B",
    statusCallbackSet: "#EAB308",
    statusQuoteGiven: "#3B82F6",
    statusSold: "#22C55E",
    statusWon: "#16A34A",
    statusLost: "#DC2626",
    statusCompleted: "#4A9B8E",
  },
  dark: {
    text: "#ECEDEE",
    textSecondary: "#8E8E93",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: "#5BB8A9",
    link: "#5BB8A9",
    primary: "#5BB8A9",
    secondary: "#C8DDD5",
    backgroundRoot: "#1C1C1E",
    backgroundDefault: "#2C2C2E",
    backgroundSecondary: "#3A3A3C",
    backgroundTertiary: "#48484A",
    border: "#38383A",
    borderLight: "#48484A",
    success: "#30D158",
    warning: "#FFD60A",
    error: "#FF453A",
    info: "#0A84FF",
    statusNotHome: "#8E8E93",
    statusKnockedNoAnswer: "#8E8E93",
    statusAnswered: "#5B8AFA",
    statusInaccessible: "#6B7280",
    statusDoNotKnock: "#991B1B",
    statusNotInterested: "#FF453A",
    statusRevisitNeeded: "#FB923C",
    statusFollowUp: "#FFD60A",
    statusCallbackSet: "#FBBF24",
    statusQuoteGiven: "#60A5FA",
    statusSold: "#30D158",
    statusWon: "#34D399",
    statusLost: "#FF453A",
    statusCompleted: "#5BB8A9",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 44,
  buttonHeight: 48,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  h3: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  button: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600" as const,
  },
  link: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "400" as const,
  },
};

export const Shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    android: {
      elevation: 1,
    },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: {
      elevation: 3,
    },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    android: {
      elevation: 6,
    },
    default: {},
  }),
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const LEAD_STATUSES: Record<string, { label: string; color: string; isLead?: boolean }> = {
  knocked_no_answer: { label: "Knocked No Answer", color: "#9CA3AF" },
  not_home:          { label: "Not Home",           color: "#9CA3AF" },
  inaccessible:      { label: "Inaccessible",       color: "#6B7280" },
  do_not_knock:      { label: "Do Not Knock",       color: "#7F1D1D" },
  answered:          { label: "Answered",            color: "#60A5FA" },
  not_interested:    { label: "Not Interested",     color: "#EF4444",  isLead: true },
  revisit_needed:    { label: "Revisit Needed",     color: "#F97316",  isLead: true },
  follow_up:         { label: "Follow Up",          color: "#F59E0B",  isLead: true },
  callback_set:      { label: "Callback Set",       color: "#EAB308",  isLead: true },
  quote_given:       { label: "Quote Given",        color: "#3B82F6",  isLead: true },
  estimate_scheduled:{ label: "Estimate Scheduled", color: "#8B5CF6",  isLead: true },
  sold:              { label: "Sold",               color: "#22C55E",  isLead: true },
  won:               { label: "Won",                color: "#16A34A",  isLead: true },
  lost:              { label: "Lost",               color: "#DC2626",  isLead: true },
  completed:         { label: "Completed",          color: "#4A9B8E",  isLead: true },
};

export const DOOR_OUTCOMES = ["knocked_no_answer", "not_home", "inaccessible", "do_not_knock", "answered"] as const;
export type DoorOutcome = typeof DOOR_OUTCOMES[number];

export const LOST_REASONS = [
  { value: "price",           label: "Price" },
  { value: "already_has_guy", label: "Already has a guy" },
  { value: "diy",             label: "DIY" },
  { value: "service_issue",   label: "Service issue" },
  { value: "didnt_want_it",   label: "Didn't want it" },
  { value: "already_had_it",  label: "Already had it done" },
  { value: "no_idea",         label: "No idea" },
] as const;

export const SERVICES = [
  "House Wash",
  "Cement Cleaning",
  "Roof Wash",
  "Gutter Cleaning",
  "Window Cleaning",
  "Deck Staining",
  "Driveway Sealing",
  "Holiday Lighting",
  "Other",
];

export const BRAND = {
  primary: "#4A9B8E",
  dark: "#1B3A4B",
  light: "#C8DDD5",
  bg: "#F7FAF9",
};
