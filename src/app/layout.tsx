import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forge | Learn to build with AI",
  description: "Practical lessons, guided practice and learning records for future software builders.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('forge-theme')==='dark')document.documentElement.dataset.theme='dark'}catch(e){}" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}