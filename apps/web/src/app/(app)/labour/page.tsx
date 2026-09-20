import type { Metadata } from "next";
import { LabourPage } from "@/components/labour/labour-page";

export const metadata: Metadata = { title: "Labour" };

export default function Page() {
  return <LabourPage />;
}
