import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "连连看 | Link Game",
  description:
    "浏览器连连看小游戏：选子、连通消除、计时与多关卡。Browser link-matching puzzle with levels and hints.",
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
