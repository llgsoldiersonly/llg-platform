import type { Metadata } from 'next'
import { Geist, Geist_Mono, DM_Serif_Display } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// LLG brand serif — used for major headings (firm name in topbar, big page
// titles, card titles on the client portal). Sans stays Geist for body.
const dmSerifDisplay = DM_Serif_Display({
  variable: '--font-serif-display',
  weight: '400',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'LLG Platform',
  description: 'Legal Leads Group — client portal and ops dashboard',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${dmSerifDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  )
}
