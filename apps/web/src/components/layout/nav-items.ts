import { Bot, CheckSquare, HardHat, Home, Landmark, Plug, Receipt, Settings, Truck, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar. */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: Home, primary: true },
  { href: "/jobs/", label: "Jobs", icon: Landmark, primary: true },
  { href: "/labour/", label: "Labour", icon: HardHat, primary: true },
  { href: "/billing/", label: "Billing", icon: Receipt, primary: true },
  { href: "/resources/", label: "Resources", icon: Truck },
  { href: "/approvals/", label: "Approvals", icon: CheckSquare },
  { href: "/agents/", label: "Agents", icon: Bot },
  { href: "/integrations/", label: "Integrations", icon: Plug },
  { href: "/settings/", label: "Settings", icon: Settings },
];

export function isActive(pathname: string, href: string) {
  const p = pathname.replace(/\/+$/, "") || "/";
  const h = href.replace(/\/+$/, "") || "/";
  return p === h;
}
