import '../styles/globals.css'
import { ProgressProvider } from '@/context/ProgressProvider'
import { SettingsProvider } from '@/context/SettingsProvider'
import { LanguageProvider } from '@/context/LanguageProvider'
import { LanguageConfigProvider } from '@/context/LanguageConfigProvider'
import { TargetLanguageProvider } from '@/context/TargetLanguageProvider'
import { Providers } from '@/components/providers'
import ClientLayout from '@/components/layout/ClientLayout'
import { ReactNode } from 'react'

export const metadata = {
  title: 'Murmura - Learn Languages',
  description: 'Murmura - From whispers to fluency. Master Japanese, Spanish, German, English, Italian, Korean, and Chinese with interactive exercises.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'icon', url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { rel: 'icon', url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <LanguageConfigProvider>
            <SettingsProvider>
              <LanguageProvider>
                <TargetLanguageProvider>
                  <ProgressProvider>
                    <ClientLayout>
                      {children}
                    </ClientLayout>
                  </ProgressProvider>
                </TargetLanguageProvider>
              </LanguageProvider>
            </SettingsProvider>
          </LanguageConfigProvider>
        </Providers>
      </body>
    </html>
  )
}
