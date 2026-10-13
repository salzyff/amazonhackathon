import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plan B · When plans change",
  description:
    "Keep your household’s plans in one place. When something changes, see who’s free and ask for a hand.",
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
