import { Platform } from "react-native";

const primaryBlue = "#0066CC";
const safetyOrange = "#FF6B35";

export const Colors = {
  light: {
    text: "#1C1C1E",
    textSecondary: "#8E8E93",
    buttonText: "#FFFFFF",
    tabIconDefault: "#8E8E93",
    tabIconSelected: primaryBlue,
    link: primaryBlue,
    primary: primaryBlue,
    secondary: safetyOrange,
    backgroundRoot: "#FFFFFF",
    backgroundDefault: "#F5F5F7",
    backgroundSecondary: "#E8E8ED",
    backgroundTertiary: "#D1D1D6",
    border: "#C6C6C8",
    borderLight: "#E5E5EA",
    success: "#34C759",
    warning: "#FFCC00",
    error: "#FF3B30",
    info: "#007AFF",
    statusNew: "#34C759",
    statusInterested: "#007AFF",
    statusQuoted: "#FF9500",
    statusBooked: "#5856D6",
    statusDoNotKnock: "#FF3B30",
    statusNoAnswer: "#8E8E93",
    statusContacted: "#32ADE6",
    statusNotInterested: "#AF52DE",
  },
  dark: {
    text: "#ECEDEE",
    textSecondary: "#8E8E93",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: "#0A84FF",
    link: "#0A84FF",
    primary: "#0A84FF",
    secondary: "#FF6B35",
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
    statusNew: "#30D158",
    statusInterested: "#0A84FF",
    statusQuoted: "#FF9F0A",
    statusBooked: "#5E5CE6",
    statusDoNotKnock: "#FF453A",
    statusNoAnswer: "#8E8E93",
    statusContacted: "#64D2FF",
    statusNotInterested: "#BF5AF2",
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
