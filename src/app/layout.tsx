import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/modules/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Falu Change Request",
  description: "Interne Änderungsanträge der Falu AG",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  return (
    <html lang="de" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full"><AppShell user={user}>{children}</AppShell></body>
    </html>
  );
}
