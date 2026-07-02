import type { Metadata } from "next";
import { Bebas_Neue, Work_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ReactQueryProvider } from "@/components/ReactQueryProvider";

const display = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});
const body = Work_Sans({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "NOVA NIGHT — Mini Ticketbox",
  description: "Đặt vé Concert NOVA NIGHT — 500 vé giới hạn",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body
        className={`${body.variable} ${mono.variable} font-body bg-ink min-h-screen`}
      >
        <ReactQueryProvider>{children}</ReactQueryProvider>
      </body>
    </html>
    // <html lang="vi">
    //   <body
    //     className={`${display.variable} ${body.variable} ${mono.variable} font-body bg-ink min-h-screen`}
    //   >
    //     <ReactQueryProvider>{children}</ReactQueryProvider>
    //   </body>
    // </html>
  );
}
