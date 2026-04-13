import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "对对碰 | Duiduipeng",
  description:
    "浏览器对对碰三消小游戏：相邻交换、三消连锁与下落补位、步数内达成目标分。Browser match-3 style puzzle with moves and scoring.",
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
