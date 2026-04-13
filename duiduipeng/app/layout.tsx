import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "对对碰 | Duiduipeng",
  description:
    "浏览器三消小游戏：相邻交换仅当能形成三消；连锁为检测三消、消除、重力下落补位直至无三消；得分含每格基础分与连锁波次加成，在步数内达成目标分。Browser match-3 with gravity refills and chain scoring.",
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
