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
    statusNotInterested: "#EF4444",
    statusFollowUp: "#F59E0B",
    statusSold: "#22C55E",
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
    statusNotInterested: "#FF453A",
    statusFollowUp: "#FFD60A",
    statusSold: "#30D158",
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

export const LEAD_STATUSES = {
  not_home: { label: "Not Home", color: "#9CA3AF" },
  not_interested: { label: "Not Interested", color: "#EF4444" },
  follow_up: { label: "Follow Up", color: "#F59E0B" },
  sold: { label: "Sold", color: "#22C55E" },
  completed: { label: "Completed", color: "#4A9B8E" },
};

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
