import type { Metadata } from 'next';
import { Figtree } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { CompareProvider } from '@/lib/compare-store';

const figtree = Figtree({ subsets: ['latin'], variable: '--font-figtree', weight: ['400', '500', '600', '700', '800'] });

export const metadata: Metadata = {
  title: 'TranscriptQA',
  description: 'Compare transcripts with the QA version and the AI template.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={figtree.variable}>
      <body className="min-h-screen font-sans antialiased">
        <AuthProvider>
          <CompareProvider>{children}</CompareProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
