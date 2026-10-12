import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "JewelryAI — Design Studio",
  description: "A parametric jewelry studio for creating, revising, inspecting, and exporting ring designs.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
