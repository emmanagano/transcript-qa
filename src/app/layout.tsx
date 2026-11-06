import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { CompareProvider } from '@/lib/compare-store';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', weight: ['400', '500', '600', '700'] });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', weight: ['600', '700'] });

export const metadata: Metadata = {
  title: 'TranscriptQA',
  description: 'Compare transcripts with the QA version and the AI template.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <AuthProvider>
          <CompareProvider>{children}</CompareProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
