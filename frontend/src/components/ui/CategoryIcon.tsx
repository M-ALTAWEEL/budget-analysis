import {
  BookOpen,
  Bus,
  CircleEllipsis,
  Coffee,
  Gamepad2,
  HeartPulse,
  Receipt,
  ShoppingBag,
  Tag,
  Utensils,
  type LucideIcon,
} from "lucide-react";

import type { Category } from "@/types/api";

// The backend stores Lucide icon names ("utensils"); this maps them to components.
const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  bus: Bus,
  "book-open": BookOpen,
  "gamepad-2": Gamepad2,
  "shopping-bag": ShoppingBag,
  "heart-pulse": HeartPulse,
  receipt: Receipt,
  "circle-ellipsis": CircleEllipsis,
  coffee: Coffee,
  tag: Tag,
};

export function CategoryIcon({ category, size = "md" }: { category: Category; size?: "sm" | "md" }) {
  const Icon = ICONS[category.icon] ?? Tag;
  const box = size === "sm" ? "size-8 rounded-lg" : "size-10 rounded-xl";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${box}`}
      // A light tint of the category colour behind the icon in full colour.
      style={{ backgroundColor: `${category.color}1f`, color: category.color }}
      aria-hidden
    >
      <Icon className={size === "sm" ? "size-4" : "size-5"} strokeWidth={2} />
    </span>
  );
}
