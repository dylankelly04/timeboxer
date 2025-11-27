import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

Geist({ subsets: ["latin"] })
Geist_Mono({ subsets: ["latin"] })

// <CHANGE> Updated metadata for task planner app
export const metadata: Metadata = {
  title: "Flowday - Task Planner",
  description: "Plan your day with time-blocking and task management",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
