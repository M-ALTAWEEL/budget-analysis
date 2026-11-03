import {
  ArrowDownToLine,
  BarChart3,
  CircleHelp,
  HandCoins,
  LayoutDashboard,
  MessageCircle,
  PiggyBank,
  ReceiptText,
  Repeat,
  Settings,
  Shapes,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { PlaceId } from "@/lib/commands";

/** One icon per place (lib/commands.ts); the app has the same map with lucide-react-native. */
export const PLACE_ICONS: Record<PlaceId, LucideIcon> = {
  overview: LayoutDashboard,
  expenses: ReceiptText,
  budget: Target,
  goals: PiggyBank,
  groups: Users,
  assistant: MessageCircle,
  categories: Shapes,
  settings: Settings,
  income: Wallet,
  recurring: Repeat,
  debts: HandCoins,
  challenges: Trophy,
  inflation: TrendingUp,
  wrapped: BarChart3,
  imports: ArrowDownToLine,
  support: CircleHelp,
};
