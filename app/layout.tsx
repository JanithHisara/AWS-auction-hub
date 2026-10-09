import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import AutoRefresh from "@/components/layout/AutoRefresh";
import GlobalChatNotifier from "@/components/chat/GlobalChatNotifier";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Auction Platform",
  description: "Premium auctions for collectors",
};

import { ConfirmProvider } from "@/components/ui/ConfirmProvider"

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = await getUserRole()

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[var(--background)] text-[var(--foreground)]`}
      >
        <ConfirmProvider>
          <AutoRefresh />
          <GlobalChatNotifier userId={user?.id} role={role} />
        <Navbar user={user} role={role} />
        {children}
        </ConfirmProvider>
      </body>
    </html>
  );
}


