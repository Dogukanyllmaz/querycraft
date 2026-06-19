import { useState, useCallback } from 'react'
import { adminService, type AuditLog } from '@/services/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Download, RefreshCw, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  LOGIN:                 { label: 'Giriş',         color: 'bg-green-100 text-green-700' },
  LOGIN_FAILED:          { label: 'Hatalı Giriş',  color: 'bg-red-100 text-red-700' },
  LOGOUT:                { label: 'Çıkış',          color: 'bg-slate-100 text-slate-600' },
  SIGNUP:                { label: 'Kayıt',          color: 'bg-blue-100 text-blue-700' },
  CHANGE_PASSWORD:       { label: 'Şifre Değişti', color: 'bg-amber-100 text-amber-700' },
  PASSWORD_RESET:        { label: 'Şifre Sıfırla', color: 'bg-amber-100 text-amber-700' },
  PASSWORD_RESET_REQUEST:{ label: 'Şifre İsteği',  color: 'bg-amber-50 text-amber-600' },
  RUN_REPORT:            { label: 'Rapor Çalıştır',color: 'bg-indigo-100 text-indigo-700' },
  CREATE_REPORT:         { label: 'Rapor Oluştur', color: 'bg-blue-100 text-blue-700' },
  GRANT_ACCESS:          { label: 'Erişim Ver',    color: 'bg-teal-100 text-teal-700' },
  REVOKE_ACCESS:         { label: 'Erişim Kaldır', color: 'bg-orange-100 text-orange-700' },
  CREATE_USER:           { label: 'Kullanıcı Ekle',color: 'bg-blue-100 text-blue-700' },
  DELETE_USER:           { label: 'Kullanıcı Sil', color: 'bg-red-100 text-red-700' },
  UPDATE_ROLE:           { label: 'Rol Güncelle',  color: 'bg-purple-100 text-purple-700' },
  CREATE_GROUP:          { label: 'Grup Oluştur',  color: 'bg-blue-100 text-blue-700' },
  DELETE_GROUP:          { label: 'Grup Sil',      color: 'bg-red-100 text-red-700' },
  REVOKE_SESSIONS:       { label: 'Oturum Kapat',  color: 'bg-orange-100 text-orange-700' },
  UPDATE_SETTINGS:       { label: 'Ayar Güncelle', color: 'bg-purple-100 text-purple-700' },
}

function ActionBadge({ action }: { action: string }) {
  const info = ACTION_LABELS[action] ?? { label: action, color: 'bg-slate-100 text-slate-600' }
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded-md text-xs font-medium', info.color)}>
      {info.label}
    </span>
  )
}

const PAGE_SIZE = 100

export function AdminAuditLog() {
  const [logs, setLogs]     = useState<AuditLog[]>([])
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  const [loaded, setLoaded] = useState(false)

  // Filters
  const [filterEmail, setFilterEmail]   = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterFrom, setFilterFrom]     = useState('')
  const [filterTo, setFilterTo]         = useState('')

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    try {
      const res = await adminService.getAuditLog({
        action: filterAction || undefined,
        from:   filterFrom || undefined,
        to:     filterTo   || undefined,
        limit:  PAGE_SIZE,
        offset: off,
      })
      setLogs(res.data.data.logs)
      setTotal(res.data.data.total)
      setOffset(off)
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }, [filterAction, filterFrom, filterTo])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    load(0)
  }

  function exportCSV() {
    const headers = ['Zaman', 'Kullanıcı', 'IP', 'İşlem', 'Kaynak', 'Kaynak Adı']
    const rows = logs.map((l) => [
      new Date(l.created_at).toLocaleString('tr-TR'),
      l.user_email || l.user_id || '',
      l.ip || '',
      l.action,
      l.resource_type || '',
      l.resource_name || '',
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `audit-log-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Log</h1>
          <p className="text-slate-500 text-sm mt-1">Sistem genelindeki kullanıcı aktivitelerini izleyin.</p>
        </div>
        {loaded && logs.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1.5" /> CSV İndir
          </Button>
        )}
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            placeholder="E-posta ile filtrele (yakında)"
            value={filterEmail}
            onChange={(e) => setFilterEmail(e.target.value)}
            disabled
          />
          <Input
            placeholder="İşlem (LOGIN, RUN_REPORT...)"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value.toUpperCase())}
          />
          <Input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            title="Başlangıç tarihi"
          />
          <Input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            title="Bitiş tarihi"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? <Spinner className="h-4 w-4" /> : <><Search className="h-4 w-4 mr-1.5" />Ara</>}
          </Button>
          {loaded && (
            <Button type="button" variant="outline" size="sm" onClick={() => load(offset)}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>

      {/* Table */}
      {loaded && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {total.toLocaleString('tr-TR')} kayıt
              {total > PAGE_SIZE ? ` (gösterilen: ${offset + 1}–${Math.min(offset + logs.length, total)})` : ''}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                disabled={offset === 0}
                onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
              >Önceki</Button>
              <Button
                variant="outline" size="sm"
                disabled={offset + logs.length >= total}
                onClick={() => load(offset + PAGE_SIZE)}
              >Sonraki</Button>
            </div>
          </div>

          {logs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-12">Kayıt bulunamadı.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Zaman', 'Kullanıcı', 'İşlem', 'Kaynak', 'IP'].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('tr-TR')}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 text-xs">
                        {log.user_email || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {log.resource_name ? (
                          <span className="text-slate-700">{log.resource_name}</span>
                        ) : log.resource_type ? (
                          <span className="text-slate-400">{log.resource_type}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">
                        {log.ip || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loaded && !loading && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <p className="text-slate-400 text-sm">Kayıtları görmek için "Ara" düğmesine tıklayın.</p>
        </div>
      )}
    </div>
  )
}
