import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Çeviri Geri Bildirim Çalışması",
  description: "Mütercim-Tercümanlık öğrencileri için LLM ve XAI destekli çeviri geri bildirimi."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>
        <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </body>
    </html>
  );
}
