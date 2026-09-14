import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CamMusic AI - Khmer & Global AI Music Studio',
  description: 'Produce high-quality Khmer and international AI music with custom lyrics, instant dual-version tracks, and direct MP3/WAV/SRT downloads.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="km" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Battambang:wght@400;700&family=Inter:wght@400;500;600;700&family=Kantumruy+Pro:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased h-screen flex flex-col overflow-hidden bg-studio-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
