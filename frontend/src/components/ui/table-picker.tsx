import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, ChevronDown, X, Table2, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TableEntry } from '@/services/connections'

interface Props {
  tables: TableEntry[]
  value: string
  onChange: (name: string) => void
  placeholder?: string
  disabled?: boolean
}

export function TablePicker({ tables, value, onChange, placeholder = 'Search table...', disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? tables.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
    : tables

  const selectedEntry = tables.find((t) => t.name === value)

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

  const select = useCallback((name: string) => {
    onChange(name)
    setOpen(false)
    setQuery('')
  }, [onChange])

  const viewCount = tables.filter((t) => t.type === 'view').length

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
        <span className={cn('flex items-center gap-2 min-w-0', value ? 'text-gray-900' : 'text-gray-400')}>
          {selectedEntry && (
            selectedEntry.type === 'view'
              ? <Eye className="h-3.5 w-3.5 text-violet-400 shrink-0" />
              : <Table2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          )}
          <span className={cn('truncate', value && 'font-mono')}>{value || placeholder}</span>
          {selectedEntry?.type === 'view' && (
            <span className="text-[10px] font-semibold text-violet-500 bg-violet-50 border border-violet-100 rounded px-1 py-0.5 leading-none shrink-0">VIEW</span>
          )}
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
              placeholder="Search tables & views..."
              className="flex-1 text-sm outline-none placeholder:text-gray-400 bg-transparent"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Count */}
          <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100 flex items-center gap-2">
            <span>{filtered.length} of {tables.length} objects</span>
            {viewCount > 0 && (
              <span className="flex items-center gap-1 text-violet-400">
                <Eye className="h-3 w-3" /> {viewCount} view{viewCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* List */}
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400 text-center">No tables or views found</li>
            ) : (
              filtered.map((t) => (
                <li
                  key={t.name}
                  onClick={() => select(t.name)}
                  className={cn(
                    'px-3 py-2 text-sm cursor-pointer select-none transition-colors flex items-center gap-2',
                    t.name === value
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  {t.type === 'view'
                    ? <Eye className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                    : <Table2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  }
                  <span className="font-mono truncate flex-1">{t.name}</span>
                  {t.type === 'view' && (
                    <span className="text-[10px] font-semibold text-violet-500 bg-violet-50 border border-violet-100 rounded px-1 py-0.5 leading-none shrink-0">VIEW</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
