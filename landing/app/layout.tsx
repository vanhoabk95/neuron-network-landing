import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mạng nơ-ron đọc chữ số",
  description: "Viết một chữ số và xem một mạng nơ-ron thật đọc nó, từng lớp một.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
