import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success'
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
    default:     'bg-blue-50 text-blue-700 ring-1 ring-blue-600/15',
    secondary:   'bg-slate-100 text-slate-600 ring-1 ring-slate-500/10',
    destructive: 'bg-red-50 text-red-700 ring-1 ring-red-600/15',
    outline:     'border border-slate-200 text-slate-600 bg-transparent',
    success:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
