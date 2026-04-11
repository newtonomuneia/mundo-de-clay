import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "O Mundo de Clay — Studio",
  description: "Pipeline de produção de horror claymation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 min-h-screen`}>
        <header className="border-b border-zinc-800 px-6 py-4">
          <a href="/" className="text-lg font-semibold text-zinc-100 hover:text-zinc-300">
            🎬 O Mundo de Clay — Studio
          </a>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
