import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prepaidly - Xero Prepaid & Unearned Revenue Management",
  description: "Automate prepaid expenses and unearned revenue schedules with Xero",
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

