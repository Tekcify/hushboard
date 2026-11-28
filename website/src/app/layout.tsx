import type { Metadata } from "next";
import { JetBrains_Mono, Onest } from "next/font/google";
import { GyroCursor } from "@/components/GyroCursor";import "./globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hushboard: a little pause, a cleaner keyboard",
  description:
    "Lock your keyboard while you wipe it down. Your mouse keeps working. Free and open source for macOS, Windows and Linux.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${onest.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <GyroCursor />
      </body>
    </html>
  );
}
