import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "数独2 | Suduku2",
  description: "局域网数独：核心数据模型与规则。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-950 font-sans text-zinc-100">
        {children}
      </body>
    </html>
  );
}
