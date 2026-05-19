import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "voice demo",
  description: "Voice demo by Cicada Speech",
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
