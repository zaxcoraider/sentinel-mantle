import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SENTINEL — Agent Circuit Breaker',
  description:
    'The circuit breaker for autonomous AI agents on Mantle Network. Wrap your ERC-8004 agent. Sleep at night.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://sentinel.guard',
  ),
  openGraph: {
    title: 'SENTINEL — Agent Circuit Breaker',
    description:
      'The circuit breaker for autonomous AI agents on Mantle Network.',
    type: 'website',
    images: ['/api/og'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SENTINEL — Agent Circuit Breaker',
    description:
      'The circuit breaker for autonomous AI agents on Mantle Network.',
    images: ['/api/og'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased bg-sentinel-black text-sentinel-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
