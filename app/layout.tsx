import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RAGversate - Intelligent Search',
  description: 'Advanced AI-powered search with agentic capabilities',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
