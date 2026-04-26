import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Repo Analyzer Green",
  description: "Evidence-backed repository quality analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
