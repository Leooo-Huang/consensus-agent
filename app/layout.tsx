import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "议见 YiJian",
  description: "企业 AI 共识形成系统",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="antialiased">
      <body>{children}</body>
    </html>
  );
}
