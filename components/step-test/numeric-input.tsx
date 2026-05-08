'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface NumericInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  min?: number
  max?: number
  step?: number
  unit?: string
  decimal?: boolean
  className?: string
}

export function NumericInput({
  value,
  onChange,
  placeholder,
  min = 0,
  max = 999,
  step = 1,
  unit,
  decimal = false,
  className,
}: NumericInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  const numericValue = value ? parseFloat(value) : 0

  const increment = () => {
    const newValue = Math.min(numericValue + step, max)
    onChange(decimal ? newValue.toFixed(1) : String(Math.round(newValue)))
  }

  const decrement = () => {
    const newValue = Math.max(numericValue - step, min)
    onChange(decimal ? newValue.toFixed(1) : String(Math.round(newValue)))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    
    // Allow empty
    if (val === '') {
      onChange('')
      return
    }
    
    // Validate input
    if (decimal) {
      if (/^\d*\.?\d*$/.test(val)) {
        onChange(val)
      }
    } else {
      if (/^\d*$/.test(val)) {
        onChange(val)
      }
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
    
    // Clamp value on blur
    if (value) {
      const num = parseFloat(value)
      if (!isNaN(num)) {
        const clamped = Math.max(min, Math.min(max, num))
        onChange(decimal ? clamped.toFixed(1) : String(Math.round(clamped)))
      }
    }
  }

  return (
    <div 
      className={cn(
        'flex items-center gap-2 p-2 rounded-xl border-2 transition-colors',
        isFocused ? 'border-primary' : 'border-input',
        className
      )}
    >
      {/* Decrement button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-12 rounded-lg shrink-0"
        onClick={decrement}
        disabled={numericValue <= min}
      >
        <Minus className="size-6" />
      </Button>

      {/* Input */}
      <div className="flex-1 text-center relative">
        <Input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            'text-4xl font-mono font-bold text-center h-16 border-0 bg-transparent',
            'focus-visible:ring-0 focus-visible:ring-offset-0',
            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
          )}
        />
        {unit && value && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {unit}
          </span>
        )}
      </div>

      {/* Increment button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-12 rounded-lg shrink-0"
        onClick={increment}
        disabled={numericValue >= max}
      >
        <Plus className="size-6" />
      </Button>
    </div>
  )
}

// Compact version for tables
export function NumericInputCompact({
  value,
  onChange,
  placeholder,
  min = 0,
  max = 999,
  decimal = false,
  className,
}: Omit<NumericInputProps, 'step' | 'unit'>) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    
    if (val === '') {
      onChange('')
      return
    }
    
    if (decimal) {
      if (/^\d*\.?\d*$/.test(val)) {
        onChange(val)
      }
    } else {
      if (/^\d*$/.test(val)) {
        onChange(val)
      }
    }
  }

  const handleBlur = () => {
    if (value) {
      const num = parseFloat(value)
      if (!isNaN(num)) {
        const clamped = Math.max(min, Math.min(max, num))
        onChange(decimal ? clamped.toFixed(1) : String(Math.round(clamped)))
      }
    }
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={cn(
        'font-mono text-center w-20',
        '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
        className
      )}
    />
  )
}
