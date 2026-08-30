import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ON8 — Email Scheduler',
  description: 'Schedule and manage email campaigns with ease. Rate-limited, persistent, and production-ready.',
  keywords: ['email', 'scheduler', 'campaigns', 'outreach'],
  openGraph: {
    title: 'ON8 — Email Scheduler',
    description: 'Schedule and manage email campaigns with rate limiting and analytics.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
