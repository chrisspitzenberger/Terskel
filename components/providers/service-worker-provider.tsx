'use client'

import { useEffect } from 'react'

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[SW] Service Worker registered:', registration.scope)
        })
        .catch((error) => {
          console.error('[SW] Service Worker registration failed:', error)
        })
    }
  }, [])

  return <>{children}</>
}
