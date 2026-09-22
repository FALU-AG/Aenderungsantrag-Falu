import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/modules/auth";
import { withBasePath } from "@/lib/app-paths";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Falu Change Request",
  description: "Interne Änderungsanträge der Falu AG",
  icons: {
    icon: [{ url: withBasePath("/icon.svg"), type: "image/svg+xml" }],
    shortcut: [withBasePath("/icon.svg")],
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Every page reaching this layout is already behind the proxy: it answers the public paths
  // itself and sends the former local auth pages to the portal. So there is no unauthenticated
  // case left to branch on, and no forced password change either - that lives in the portal now.
  const user = await getCurrentUser();
  return (
    <html lang="de" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full"><AppShell user={user}>{children}</AppShell></body>
    </html>
  );
}
