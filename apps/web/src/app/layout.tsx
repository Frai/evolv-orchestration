import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppStateProvider } from "@/components/providers/app-state";

export const metadata: Metadata = {
  title: { default: "Evolv", template: "%s · Evolv" },
  description: "Margin, billing and crew signals for oil and gas contractors, briefed every morning.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f8fa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <body>
        <AppStateProvider>{children}</AppStateProvider>
      </body>
    </html>
  );
}
