import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReturnRadar — purchases, returns & warranties",
  description:
    "Your private purchase tracker. Keep receipts, verify deadlines and prepare return or warranty requests.",
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
