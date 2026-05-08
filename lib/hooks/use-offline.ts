'use client'

import { useState, useEffect } from 'react'

export function useOffline() {
  const [isOnline, setIsOnline] = useState(true)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    // Check initial state
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      if (!navigator.onLine === false) {
        setWasOffline(true)
        // Reset the flag after a delay
        setTimeout(() => setWasOffline(false), 5000)
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, wasOffline }
}

export function useServiceWorker() {
  const [isReady, setIsReady] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    navigator.serviceWorker.ready.then(() => {
      setIsReady(true)
    })

    // Listen for updates
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      setUpdateAvailable(true)
    })
  }, [])

  const update = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      await registration.update()
      window.location.reload()
    }
  }

  return { isReady, updateAvailable, update }
}
