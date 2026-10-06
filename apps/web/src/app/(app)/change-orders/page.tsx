import type { Metadata } from "next";
import { ChangeOrdersPage } from "@/components/change-orders/change-orders-page";

export const metadata: Metadata = { title: "Change orders" };

export default function Page() {
  return <ChangeOrdersPage />;
}
