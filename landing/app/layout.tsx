import type { Metadata } from "next";
import "../components/iso/iso.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mạng nơ-ron đọc chữ số",
  description: "Viết một chữ số và xem một mạng nơ-ron thật đọc nó, từng lớp một.",
};

// The kit's tokens live on .iso; data-theme follows the visitor's system setting, set before
// first paint so neither theme flashes, and kept in step when the setting changes.
const THEME = `(()=>{const q=matchMedia("(prefers-color-scheme: dark)");const set=()=>document.documentElement.setAttribute("data-theme",q.matches?"dark":"light");set();q.addEventListener("change",set)})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className="iso" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
