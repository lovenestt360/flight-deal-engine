import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flight Deal Engine",
  description: "Find the lowest legitimate executable cash cost for a journey.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
