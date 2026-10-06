import { Bot, CalendarClock, CheckSquare, FileDiff, HardHat, Home, Plug, Settings, Wallet, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar. */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: Home, primary: true },
  { href: "/projects/", label: "Projects", icon: HardHat, primary: true },
  { href: "/change-orders/", label: "Change orders", icon: FileDiff, primary: true },
  { href: "/schedule/", label: "Schedule", icon: CalendarClock, primary: true },
  { href: "/payments/", label: "Subs & payments", icon: Wallet },
  { href: "/approvals/", label: "Approvals", icon: CheckSquare },
  { href: "/agents/", label: "Agents", icon: Bot },
  { href: "/integrations/", label: "Integrations", icon: Plug },
  { href: "/settings/", label: "Settings", icon: Settings },
];

export const MOBILE_LABEL: Record<string, string> = { "/change-orders/": "COs" };

export function isActive(pathname: string, href: string) {
  const p = pathname.replace(/\/+$/, "") || "/";
  const h = href.replace(/\/+$/, "") || "/";
  return p === h;
}
