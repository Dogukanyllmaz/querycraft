import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  tables: string[]
  value: string
  onChange: (table: string) => void
  placeholder?: string
  disabled?: boolean
}

export function TablePicker({ tables, value, onChange, placeholder = 'Search table...', disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? tables.filter((t) => t.toLowerCase().includes(query.toLowerCase()))
    : tables

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30)
  }, [open])

  const select = useCallback((t: string) => {
    onChange(t)
    setOpen(false)
    setQuery('')
  }, [onChange])

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open && 'ring-2 ring-blue-500 border-transparent'
        )}
      >
        <span className={value ? 'text-gray-900 font-mono' : 'text-gray-400'}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange(''); setQuery('') }}
              onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), onChange(''), setQuery(''))}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          {/* Search box */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tables..."
              className="flex-1 text-sm outline-none placeholder:text-gray-400 bg-transparent"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Count */}
          <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100">
            {filtered.length} of {tables.length} tables
          </div>

          {/* List */}
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400 text-center">No tables found</li>
            ) : (
              filtered.map((t) => (
                <li
                  key={t}
                  onClick={() => select(t)}
                  className={cn(
                    'px-3 py-2 text-sm font-mono cursor-pointer select-none transition-colors',
                    t === value
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  {t}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
