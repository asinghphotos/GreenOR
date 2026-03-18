import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GreenOR — Sustainable Surgery Starts Here',
  description: 'Track and reduce the carbon footprint of surgical cases.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-beige text-green-900 antialiased">
        {children}
      </body>
    </html>
  )
}
