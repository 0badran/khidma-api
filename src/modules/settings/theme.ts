import { z } from "zod";

// Theme color names match the CSS custom properties in khidma-web's globals.css
// exactly (without the `--` prefix), so the site can inject them as-is and the
// mobile app can map the same names later.
export const themeColorKeys = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
] as const;

export type ThemeColorKey = (typeof themeColorKeys)[number];

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const radiusValue = z.string().regex(/^\d+(\.\d+)?(rem|px)$/);

const colorFields = Object.fromEntries(themeColorKeys.map((key) => [key, hexColor])) as Record<
  ThemeColorKey,
  typeof hexColor
>;

export const themeModeSchema = z.object({
  ...colorFields,
  radius: radiusValue,
});
export type ThemeMode = z.infer<typeof themeModeSchema>;

export const themeSchema = z.object({
  light: themeModeSchema,
  dark: themeModeSchema,
});
export type Theme = z.infer<typeof themeSchema>;

// What the admin is allowed to send: either mode, any subset of keys.
export const themeInputSchema = z
  .object({
    light: themeModeSchema.partial().optional(),
    dark: themeModeSchema.partial().optional(),
  })
  .refine((input) => input.light !== undefined || input.dark !== undefined);
export type ThemeInput = z.infer<typeof themeInputSchema>;

// Derived from logo A: blue #0F4C81 (primary) and orange #F28C28 (accent).
export const defaultTheme: Theme = {
  light: {
    background: "#FFFFFF",
    foreground: "#0F1B2D",
    card: "#FFFFFF",
    "card-foreground": "#0F1B2D",
    popover: "#FFFFFF",
    "popover-foreground": "#0F1B2D",
    primary: "#0F4C81",
    "primary-foreground": "#FFFFFF",
    secondary: "#EAF1F8",
    "secondary-foreground": "#0F4C81",
    muted: "#F1F5F9",
    "muted-foreground": "#5B6B7F",
    accent: "#F28C28",
    "accent-foreground": "#26160A",
    destructive: "#DC2626",
    border: "#DCE4EC",
    input: "#DCE4EC",
    ring: "#0F4C81",
    "chart-1": "#0F4C81",
    "chart-2": "#F28C28",
    "chart-3": "#4A90D9",
    "chart-4": "#F5B56B",
    "chart-5": "#5B6B7F",
    radius: "0.625rem",
    sidebar: "#F7FAFC",
    "sidebar-foreground": "#0F1B2D",
    "sidebar-primary": "#0F4C81",
    "sidebar-primary-foreground": "#FFFFFF",
    "sidebar-accent": "#EAF1F8",
    "sidebar-accent-foreground": "#0F4C81",
    "sidebar-border": "#DCE4EC",
    "sidebar-ring": "#0F4C81",
  },
  dark: {
    background: "#0B1524",
    foreground: "#F0F4F9",
    card: "#101E33",
    "card-foreground": "#F0F4F9",
    popover: "#101E33",
    "popover-foreground": "#F0F4F9",
    primary: "#4A90D9",
    "primary-foreground": "#07101D",
    secondary: "#1A2C47",
    "secondary-foreground": "#E6EEF7",
    muted: "#16233A",
    "muted-foreground": "#8DA1B9",
    accent: "#F28C28",
    "accent-foreground": "#26160A",
    destructive: "#EF4444",
    border: "#24385A",
    input: "#24385A",
    ring: "#4A90D9",
    "chart-1": "#4A90D9",
    "chart-2": "#F28C28",
    "chart-3": "#7FB3E8",
    "chart-4": "#F5B56B",
    "chart-5": "#8DA1B9",
    radius: "0.625rem",
    sidebar: "#101E33",
    "sidebar-foreground": "#F0F4F9",
    "sidebar-primary": "#4A90D9",
    "sidebar-primary-foreground": "#07101D",
    "sidebar-accent": "#1A2C47",
    "sidebar-accent-foreground": "#E6EEF7",
    "sidebar-border": "#24385A",
    "sidebar-ring": "#4A90D9",
  },
};
