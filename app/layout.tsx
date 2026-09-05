import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'RADAR / CS2 · 选手数据对比', description: '导入 HLTV 比赛与赛事链接，以雷达图展示选手表现，支持跨比赛、跨赛事及同一选手对比。' };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="zh-CN" className="dark"><body>{children}</body></html>; }
