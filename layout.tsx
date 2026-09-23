import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'Xavier Planner OS — Make every day count',description:'One connected planner for your year, month, week and day.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}
