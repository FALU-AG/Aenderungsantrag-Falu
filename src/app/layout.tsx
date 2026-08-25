import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/modules/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isPublicAuthPath } from "@/modules/auth/public-routes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Falu Change Request",
  description: "Interne Änderungsanträge der Falu AG",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = (await headers()).get("x-falu-pathname") ?? "/";
  const user = isPublicAuthPath(pathname) ? null : await getCurrentUser();
  if (user?.mustChangePassword && pathname !== "/change-password") redirect("/change-password");
  return (
    <html lang="de" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">{user ? <AppShell user={user}>{children}</AppShell> : children}</body>
    </html>
  );
}
