import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plan B · A little help when life happens",
  description: "A shared household assistant. Make a new plan, check everyone's availability, and keep the day moving.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
