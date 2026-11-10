import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { hub } from "@/hub.config.ts";
import "./globals.css";

export const metadata: Metadata = { title: hub.name, description: hub.description, robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ "--accent": hub.color } as CSSProperties}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
