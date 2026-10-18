import {
  Baby,
  BookOpen,
  Building,
  Bus,
  Car,
  CircleEllipsis,
  Coffee,
  Droplet,
  Dumbbell,
  Flame,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Headphones,
  HeartPulse,
  House,
  KeyRound,
  Laptop,
  PawPrint,
  Pill,
  Pizza,
  Plane,
  Receipt,
  Scissors,
  Shirt,
  ShoppingBag,
  Smartphone,
  Tag,
  Utensils,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type { Category } from "@/types/api";

// The backend stores Lucide icon names ("utensils"); this maps them to components.
// Only icons listed here can be chosen, so the bundle stays small (no "import all icons").
const ICONS: Record<string, LucideIcon> = {
  // the 8 built-in categories
  utensils: Utensils,
  bus: Bus,
  "book-open": BookOpen,
  "gamepad-2": Gamepad2,
  "shopping-bag": ShoppingBag,
  "heart-pulse": HeartPulse,
  receipt: Receipt,
  "circle-ellipsis": CircleEllipsis,
  // for the student's own categories
  building: Building, // building / compound fees (aidat)
  house: House,
  "key-round": KeyRound,
  zap: Zap,
  droplet: Droplet,
  flame: Flame,
  wifi: Wifi,
  smartphone: Smartphone,
  "graduation-cap": GraduationCap,
  laptop: Laptop,
  coffee: Coffee,
  pizza: Pizza,
  dumbbell: Dumbbell,
  shirt: Shirt,
  scissors: Scissors,
  pill: Pill,
  car: Car,
  fuel: Fuel,
  plane: Plane,
  headphones: Headphones,
  gift: Gift,
  baby: Baby,
  "paw-print": PawPrint,
  wrench: Wrench,
  tag: Tag,
};

/** Icons offered in the category form: everything after the 8 built-in ones. */
export const ICON_CHOICES = Object.keys(ICONS).slice(8);

/** Colours offered in the category form. Mid-tone, so they work on light and dark. */
export const COLOR_CHOICES = [
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#14B8A6",
  "#0EA5E9",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#64748B",
];

export function IconGlyph({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Tag;
  return <Icon className={className} strokeWidth={2} aria-hidden />;
}

export function CategoryIcon({
  category,
  size = "md",
}: {
  category: Pick<Category, "icon" | "color">;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "size-8 rounded-lg" : "size-10 rounded-xl";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${box}`}
      // A light tint of the category colour behind the icon in full colour.
      style={{ backgroundColor: `${category.color}26`, color: category.color }}
      aria-hidden
    >
      <IconGlyph name={category.icon} className={size === "sm" ? "size-4" : "size-5"} />
    </span>
  );
}
