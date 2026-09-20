import { Activity, Bot, CheckSquare, Home, Package, Plug, Settings, Users, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar. */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: Home, primary: true },
  { href: "/sales/", label: "Sales", icon: Activity, primary: true },
  { href: "/labour/", label: "Labour", icon: Users, primary: true },
  { href: "/inventory/", label: "Inventory", icon: Package, primary: true },
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
