import { useState, useEffect } from 'react'
import { adminService, type SystemSettings } from '@/services/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Shield, Mail, Zap, CheckCircle2, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'security' | 'email' | 'performance'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 items-start">
      <div>
        <Label className="text-sm">{label}</Label>
        {help && <p className="text-xs text-slate-400 mt-0.5">{help}</p>}
      </div>
      <div>{children}</div>
    </div>
  )
}

export function AdminSettings() {
  const [settings, setSettings] = useState<SystemSettings>({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')
  const [tab, setTab]           = useState<Tab>('security')

  // SMTP test
  const [testing, setTesting]     = useState(false)
  const [testResult, setTestResult] = useState<{ ok?: boolean; msg?: string } | null>(null)

  useEffect(() => {
    adminService.getSettings()
      .then((res) => setSettings(res.data.data.settings))
      .finally(() => setLoading(false))
  }, [])

  function set(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await adminService.updateSettings(settings)
      setSettings(res.data.data.settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Kayıt sırasında hata oluştu.')
    } finally {
      setSaving(false)
    }
  }

  async function handleTestSmtp() {
    setTesting(true); setTestResult(null)
    try {
      await adminService.testSmtp()
      setTestResult({ ok: true, msg: 'SMTP bağlantısı başarılı!' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setTestResult({ ok: false, msg: msg || 'Bağlantı başarısız.' })
    } finally {
      setTesting(false)
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: 'security',    label: 'Güvenlik',  icon: Shield },
    { id: 'email',       label: 'E-posta',   icon: Mail   },
    { id: 'performance', label: 'Performans', icon: Zap   },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-6 w-6 text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sistem Ayarları</h1>
        <p className="text-slate-500 text-sm mt-1">JWT süreleri, e-posta ve performans yapılandırması.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Security tab */}
        {tab === 'security' && (
          <>
            <Section title="JWT Token Süreleri">
              <Field label="Access token süresi" help="Örn: 15m, 1h, 2h">
                <Input
                  value={settings.jwt_expires_in ?? '15m'}
                  onChange={(e) => set('jwt_expires_in', e.target.value)}
                  placeholder="15m"
                />
              </Field>
              <Field label="Refresh token süresi" help="Örn: 7d, 30d">
                <Input
                  value={settings.jwt_refresh_expires_in ?? '7d'}
                  onChange={(e) => set('jwt_refresh_expires_in', e.target.value)}
                  placeholder="7d"
                />
              </Field>
            </Section>

            <Section title="Giriş Güvenliği">
              <Field label="Maks. hatalı giriş" help="Hesap kilitlenmeden önce">
                <Input
                  type="number"
                  min="1" max="20"
                  value={settings.max_login_attempts ?? '5'}
                  onChange={(e) => set('max_login_attempts', e.target.value)}
                />
              </Field>
              <Field label="Kilitlenme süresi (dk)" help="Hesabın ne kadar süre kilitli kalacağı">
                <Input
                  type="number"
                  min="1"
                  value={settings.lockout_duration_minutes ?? '15'}
                  onChange={(e) => set('lockout_duration_minutes', e.target.value)}
                />
              </Field>
            </Section>

            <Section title="Rate Limiter">
              <Field label="Auth maks. istek" help="15 dakikada kaç istek">
                <Input
                  type="number"
                  min="1"
                  value={settings.auth_rate_limit_max ?? '20'}
                  onChange={(e) => set('auth_rate_limit_max', e.target.value)}
                />
              </Field>
            </Section>
          </>
        )}

        {/* Email tab */}
        {tab === 'email' && (
          <>
            <Section title="SMTP Yapılandırması">
              <Field label="SMTP etkin">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => set('smtp_enabled', settings.smtp_enabled === 'true' ? 'false' : 'true')}
                    className={cn(
                      'relative w-10 h-6 rounded-full transition-colors cursor-pointer',
                      settings.smtp_enabled === 'true' ? 'bg-blue-500' : 'bg-slate-200'
                    )}
                  >
                    <div className={cn(
                      'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                      settings.smtp_enabled === 'true' ? 'translate-x-5' : 'translate-x-1'
                    )} />
                  </div>
                  <span className="text-sm text-slate-600">
                    {settings.smtp_enabled === 'true' ? 'Açık' : 'Kapalı (dev modda konsola yazar)'}
                  </span>
                </label>
              </Field>

              <Field label="SMTP sunucu" help="Örn: smtp.gmail.com">
                <Input
                  value={settings.smtp_host ?? ''}
                  onChange={(e) => set('smtp_host', e.target.value)}
                  placeholder="smtp.gmail.com"
                />
              </Field>
              <Field label="Port" help="587=TLS, 465=SSL, 25=düz">
                <Input
                  type="number"
                  value={settings.smtp_port ?? '587'}
                  onChange={(e) => set('smtp_port', e.target.value)}
                />
              </Field>
              <Field label="Kullanıcı adı">
                <Input
                  value={settings.smtp_user ?? ''}
                  onChange={(e) => set('smtp_user', e.target.value)}
                  placeholder="kullanici@firma.com"
                  autoComplete="username"
                />
              </Field>
              <Field label="Şifre">
                <Input
                  type="password"
                  value={settings.smtp_pass ?? ''}
                  onChange={(e) => set('smtp_pass', e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Gönderen adres">
                <Input
                  value={settings.smtp_from ?? ''}
                  onChange={(e) => set('smtp_from', e.target.value)}
                  placeholder="noreply@firma.com"
                />
              </Field>
            </Section>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestSmtp}
                disabled={testing}
              >
                {testing ? <Spinner className="h-4 w-4" /> : <><Wifi className="h-4 w-4 mr-1.5" />Bağlantıyı Test Et</>}
              </Button>
              {testResult && (
                <span className={cn('flex items-center gap-1.5 text-sm', testResult.ok ? 'text-green-700' : 'text-red-600')}>
                  {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : null}
                  {testResult.msg}
                </span>
              )}
            </div>
          </>
        )}

        {/* Performance tab */}
        {tab === 'performance' && (
          <>
            <Section title="Sorgu Önbelleği">
              <Field label="Cache TTL (saniye)" help="0 = önbellek kapalı">
                <Input
                  type="number"
                  min="0"
                  value={settings.query_cache_ttl_seconds ?? '300'}
                  onChange={(e) => set('query_cache_ttl_seconds', e.target.value)}
                />
              </Field>
            </Section>

            <Section title="Sorgu Limitleri">
              <Field label="Sorgu zaman aşımı (ms)" help="Varsayılan: 30000">
                <Input
                  type="number"
                  min="1000"
                  value={settings.query_timeout_ms ?? '30000'}
                  onChange={(e) => set('query_timeout_ms', e.target.value)}
                />
              </Field>
            </Section>

            <Section title="Bağlantı Havuzu">
              <Field label="Pool minimum">
                <Input
                  type="number"
                  min="1"
                  value={settings.pool_min ?? '1'}
                  onChange={(e) => set('pool_min', e.target.value)}
                />
              </Field>
              <Field label="Pool maksimum">
                <Input
                  type="number"
                  min="1"
                  value={settings.pool_max ?? '5'}
                  onChange={(e) => set('pool_max', e.target.value)}
                />
              </Field>
            </Section>
          </>
        )}

        <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Spinner className="h-4 w-4" /> : 'Kaydet'}
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" /> Ayarlar kaydedildi.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
