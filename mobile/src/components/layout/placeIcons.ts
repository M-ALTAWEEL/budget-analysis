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
} from "lucide-react-native";

import type { PlaceId } from "@/lib/commands";

/** The website's place icons (frontend/src/components/layout/placeIcons.ts). */
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
