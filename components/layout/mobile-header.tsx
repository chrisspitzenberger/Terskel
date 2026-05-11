'use client'

import Link from 'next/link'
import { ChevronLeft, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { OfflineIndicator } from './bottom-nav'
import { useSession, signOut } from 'next-auth/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface MobileHeaderProps {
  title: string
  backHref?: string
  backLabel?: string
  action?: React.ReactNode
}

export function MobileHeader({ title, backHref, backLabel, action }: MobileHeaderProps) {
  const { data: session } = useSession()

  return (
    <>
      <OfflineIndicator />
      <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        <div className="flex items-center gap-2">
          {backHref ? (
            <Button variant="ghost" size="icon-sm" asChild>
              <Link href={backHref}>
                <ChevronLeft className="size-5" />
                <span className="sr-only">{backLabel || 'Back'}</span>
              </Link>
            </Button>
          ) : (
            <MobileMenu />
          )}
          <h1 className="font-semibold text-lg truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {action && <div>{action}</div>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative size-8 rounded-full p-0">
                <Avatar className="size-8">
                  <AvatarImage src={session?.user?.image || undefined} alt={session?.user?.name || "User"} />
                  <AvatarFallback>{session?.user?.name?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuItem asChild>
                <Link href="/settings/profile" className="w-full cursor-pointer">
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="w-full cursor-pointer">
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={() => signOut()}>
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </>
  )
}

function MobileMenu() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <Menu className="size-5" />
          <span className="sr-only">Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span>Terskel</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="mt-6 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent"
          >
            Dashboard
          </Link>
          <Link
            href="/trainings"
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent"
          >
            Trainings
          </Link>
          <Link
            href="/step-test"
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent"
          >
            Step Tests
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
