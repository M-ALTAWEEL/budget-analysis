import {
  Baby, Bike, BookOpen, Building, Bus, Camera, Car, CircleEllipsis, Coffee, Droplet, Dumbbell,
  Flame, Fuel, Gamepad2, Gem, Gift, GraduationCap, Guitar, Headphones, HeartPulse, House, KeyRound,
  Laptop, PawPrint, PiggyBank, Pill, Pizza, Plane, Receipt, Scissors, Shirt, ShoppingBag, Smartphone,
  Sofa, Tag, Tent, TreePalm, Trophy, Utensils, Wallet, Watch, Wifi, Wrench, Zap,
  type LucideIcon,
} from "lucide-react-native";
import { View } from "react-native";

import type { Category } from "@/types/api";

// The same icon names the backend stores and the website draws (frontend CategoryIcon).
const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils, bus: Bus, "book-open": BookOpen, "gamepad-2": Gamepad2,
  "shopping-bag": ShoppingBag, "heart-pulse": HeartPulse, receipt: Receipt,
  "circle-ellipsis": CircleEllipsis, building: Building, house: House, "key-round": KeyRound,
  zap: Zap, droplet: Droplet, flame: Flame, wifi: Wifi, smartphone: Smartphone,
  "graduation-cap": GraduationCap, laptop: Laptop, coffee: Coffee, pizza: Pizza,
  dumbbell: Dumbbell, shirt: Shirt, scissors: Scissors, pill: Pill, car: Car, fuel: Fuel,
  plane: Plane, headphones: Headphones, gift: Gift, baby: Baby, "paw-print": PawPrint,
  wrench: Wrench, tag: Tag, "piggy-bank": PiggyBank, bike: Bike, camera: Camera, gem: Gem,
  guitar: Guitar, sofa: Sofa, tent: Tent, "tree-palm": TreePalm, trophy: Trophy,
  wallet: Wallet, watch: Watch,
}; // fmt: skip

export const CATEGORY_ICON_CHOICES = [
  "building", "house", "key-round", "zap", "droplet", "flame", "wifi", "smartphone",
  "graduation-cap", "laptop", "coffee", "pizza", "dumbbell", "shirt", "scissors", "pill",
  "car", "fuel", "plane", "headphones", "gift", "baby", "paw-print", "wrench", "tag",
];

export const GOAL_ICON_CHOICES = [
  "piggy-bank", "laptop", "smartphone", "plane", "tree-palm", "car", "bike", "house",
  "graduation-cap", "camera", "headphones", "guitar", "gift", "gem", "watch", "sofa",
  "tent", "trophy", "wallet", "tag",
];

export const COLOR_CHOICES = [
  "#F97316", "#EAB308", "#22C55E", "#14B8A6", "#0EA5E9", "#3B82F6", "#6366F1", "#8B5CF6",
  "#EC4899", "#EF4444", "#64748B",
];

export function IconGlyph({ name, color, size = 20 }: { name: string; color: string; size?: number }) {
  const Icon = ICONS[name] ?? Tag;
  return <Icon color={color} size={size} strokeWidth={2} />;
}

/** The category's icon in its colour, on a light tint of that colour. */
export function CategoryIcon({
  category,
  size = "md",
}: {
  category: Pick<Category, "icon" | "color">;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? 32 : 40;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: box,
        height: box,
        borderRadius: size === "sm" ? 8 : 12,
        backgroundColor: `${category.color}26`,
        alignItems: "center",
        justifyContent: "center",
      }}>
      <IconGlyph name={category.icon} color={category.color} size={size === "sm" ? 16 : 20} />
    </View>
  );
}
