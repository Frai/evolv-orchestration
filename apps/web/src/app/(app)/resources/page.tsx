import type { Metadata } from "next";
import { ResourcesPage } from "@/components/resources/resources-page";

export const metadata: Metadata = { title: "Resources" };

export default function Page() {
  return <ResourcesPage />;
}
