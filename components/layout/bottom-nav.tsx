'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Dumbbell, Activity, Settings, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOffline } from '@/lib/hooks/use-offline'

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/trainings', icon: Dumbbell, label: 'Trainings' },
  { href: '/step-test', icon: Activity, label: 'Step Test' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function BottomNav() {
  const pathname = usePathname()
  const { isOnline } = useOffline()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href))
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="size-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
      
      {/* Offline indicator */}
      {!isOnline && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-accent animate-pulse" />
      )}
    </nav>
  )
}

export function OfflineIndicator() {
  const { isOnline, wasOffline } = useOffline()

  if (isOnline && !wasOffline) return null

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors',
        isOnline
          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
          : 'bg-accent/10 text-accent'
      )}
    >
      {isOnline ? (
        <>
          <Wifi className="size-4" />
          <span>Back online - data synced</span>
        </>
      ) : (
        <>
          <WifiOff className="size-4" />
          <span>Offline - data saved locally</span>
        </>
      )}
    </div>
  )
}
