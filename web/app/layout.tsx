import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SENTINEL — Agent Circuit Breaker",
  description: "The circuit breaker for autonomous AI agents on Mantle Network.",
  openGraph: {
    title: "SENTINEL — Agent Circuit Breaker",
    description: "The circuit breaker for autonomous AI agents on Mantle Network.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
