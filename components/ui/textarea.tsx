import * as React from 'react'
import { cn } from '@/lib/utils/cn'

// Textarea — multi-line, so we use rounded-card (24px) instead of pill.
// Same color/shadow story as the Input.
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-20 w-full rounded-card border border-border-default-medium bg-neutral-secondary-medium px-4 py-3 text-sm text-heading shadow-xs transition-all duration-200',
        'placeholder:text-body',
        'hover:border-border-default-strong',
        'focus-visible:outline-none focus-visible:border-border-brand focus-visible:ring-1 focus-visible:ring-brand',
        'disabled:cursor-not-allowed disabled:bg-disabled disabled:text-fg-disabled',
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'
