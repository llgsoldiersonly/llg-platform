import type { Metadata } from 'next'
import { Roboto, Roboto_Mono } from 'next/font/google'
import './globals.css'

// Roboto across the board per the design system spec (typography.md).
// 400 = body / placeholders, 500 = labels + buttons + nav active, 600 =
// headings, 700 reserved for super-emphasis if ever needed.
const roboto = Roboto({
  variable: '--font-roboto',
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
})

const robotoMono = Roboto_Mono({
  variable: '--font-roboto-mono',
  weight: ['400', '500'],
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
      className={`${roboto.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-primary-soft text-body">
        {children}
      </body>
    </html>
  )
}
