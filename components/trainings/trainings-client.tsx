'use client'

import Link from 'next/link'
import { Plus, Search, Filter, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MobileHeader } from '@/components/layout/mobile-header'
import { TrainingCard } from '@/components/trainings/training-card'
import { useState, useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Training } from '@/lib/db/schemas'

const TRAINING_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'interval', label: 'Interval' },
  { value: 'long_run', label: 'Long Run' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'easy', label: 'Easy' },
  { value: 'race', label: 'Race' },
] as const

export function TrainingsClient({ trainings }: { trainings: Training[] }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const filteredTrainings = useMemo(() => {
    return trainings.filter((training) => {
      const matchesSearch = training.title.toLowerCase().includes(search.toLowerCase())
      const matchesType = typeFilter === 'all' || training.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [trainings, search, typeFilter])

  // Group trainings by month
  const groupedTrainings = useMemo(() => {
    const groups: { [key: string]: Training[] } = {}
    filteredTrainings.forEach((training) => {
      const date = new Date(training.date)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(training)
    })
    return groups
  }, [filteredTrainings])

  const sortedMonths = Object.keys(groupedTrainings).sort((a, b) => b.localeCompare(a))

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden">
        <MobileHeader 
          title="Trainings" 
          action={
            <Button asChild size="icon-sm">
              <Link href="/trainings/new">
                <Plus className="size-5" />
                <span className="sr-only">New Training</span>
              </Link>
            </Button>
          }
        />
      </div>

      {/* Desktop Header */}
      <header className="hidden md:flex sticky top-0 z-40 items-center justify-between h-16 px-6 border-b bg-background/95 backdrop-blur">
        <div>
          <h1 className="text-2xl font-semibold">Trainings</h1>
          <p className="text-sm text-muted-foreground">
            {trainings.length} total sessions
          </p>
        </div>
        <Button asChild>
          <Link href="/trainings/new">
            <Plus className="size-4 mr-2" />
            New Training
          </Link>
        </Button>
      </header>

      <div className="p-4 md:p-6 space-y-4">
        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search trainings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px]">
              <Filter className="size-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRAINING_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Training List */}
        {filteredTrainings.length > 0 ? (
          <div className="space-y-6">
            {sortedMonths.map((monthKey) => {
              const [year, month] = monthKey.split('-')
              const monthDate = new Date(parseInt(year), parseInt(month) - 1)
              const monthLabel = monthDate.toLocaleDateString(undefined, {
                month: 'long',
                year: 'numeric',
              })

              return (
                <div key={monthKey}>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="size-4 text-muted-foreground" />
                    <h2 className="text-sm font-medium text-muted-foreground">
                      {monthLabel}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      ({groupedTrainings[monthKey].length})
                    </span>
                  </div>
                  <div className="space-y-3">
                    {groupedTrainings[monthKey].map((training) => (
                      <TrainingCard key={training.id} training={training} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="size-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Calendar className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No trainings found</h3>
            <p className="text-muted-foreground mb-4">
              {search || typeFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Start logging your training sessions'}
            </p>
            <Button asChild>
              <Link href="/trainings/new">
                <Plus className="size-4 mr-2" />
                Log Training
              </Link>
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
