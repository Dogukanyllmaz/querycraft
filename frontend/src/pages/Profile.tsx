import { useState, useEffect } from 'react'
import { authService, type User, type Group, type Session } from '@/services/auth'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Shield, Eye, Users, Monitor, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function Avatar({ user }: { user: User }) {
  const letter = (user.display_name || user.email).charAt(0).toUpperCase()
  return (
    <div className="h-16 w-16 rounded-2xl bg-blue-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-500/30">
      {letter}
    </div>
  )
}

export function Profile() {
  const { user: authUser } = useAuth()

  const [profile, setProfile]   = useState<User | null>(null)
  const [groups, setGroups]     = useState<Group[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading]   = useState(true)

  // Profile form
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving]           = useState(false)
  const [saveMsg, setSaveMsg]         = useState('')

  // Password form
  const [currentPw, setCurrentPw]   = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [pwLoading, setPwLoading]   = useState(false)
  const [pwError, setPwError]       = useState('')
  const [pwSuccess, setPwSuccess]   = useState(false)

  useEffect(() => {
    authService.getProfile()
      .then((res) => {
        const { user, groups: g, sessions: s } = res.data.data
        setProfile(user)
        setDisplayName(user.display_name || '')
        setGroups(g)
        setSessions(s)
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await authService.updateProfile(displayName)
      setProfile(res.data.data.user)
      setSaveMsg('Profil güncellendi.')
      setTimeout(() => setSaveMsg(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (newPw.length < 8) { setPwError('Şifre en az 8 karakter olmalıdır.'); return }
    if (newPw !== confirmPw) { setPwError('Şifreler eşleşmiyor.'); return }
    setPwLoading(true)
    try {
      await authService.changePassword(currentPw, newPw)
      setPwSuccess(true)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setPwError(msg || 'Mevcut şifre hatalı.')
    } finally {
      setPwLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-6 w-6 text-blue-500" />
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Profil</h1>
        <p className="text-slate-500 text-sm mt-1">Hesap bilgilerinizi yönetin.</p>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Avatar user={profile} />
          <div>
            <p className="font-semibold text-slate-900 text-lg">
              {profile.display_name || profile.email}
            </p>
            <p className="text-slate-500 text-sm">{profile.email}</p>
            <div className="mt-1.5">
              {profile.role === 'admin' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                  <Shield className="h-3 w-3" /> Admin
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                  <Eye className="h-3 w-3" /> Viewer
                </span>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Görünen ad</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Adınız Soyadınız"
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <Label>E-posta</Label>
            <Input value={profile.email} readOnly className="bg-slate-50 text-slate-500 cursor-not-allowed" />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving} size="sm">
              {saving ? <Spinner className="h-4 w-4" /> : 'Kaydet'}
            </Button>
            {saveMsg && (
              <span className="flex items-center gap-1.5 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" /> {saveMsg}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Groups */}
      {groups.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Gruplarım</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <span key={g.id} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                {g.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Change password */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <h2 className="font-semibold text-slate-900">Şifre Değiştir</h2>

        {pwSuccess ? (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <p className="text-sm text-green-800">
              Şifreniz güncellendi. Tüm oturumlarınız kapatıldı, lütfen tekrar giriş yapın.
            </p>
          </div>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            {pwError && (
              <Alert variant="destructive">
                <AlertDescription>{pwError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="currentPw">Mevcut şifre</Label>
              <Input
                id="currentPw"
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPw">Yeni şifre</Label>
              <Input
                id="newPw"
                type="password"
                placeholder="En az 8 karakter"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPw">Yeni şifre tekrar</Label>
              <Input
                id="confirmPw"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <Button type="submit" disabled={pwLoading} variant="outline" size="sm">
              {pwLoading ? <Spinner className="h-4 w-4" /> : 'Şifreyi Güncelle'}
            </Button>
          </form>
        )}
      </div>

      {/* Sessions */}
      {sessions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="h-4 w-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Aktif Oturumlar ({sessions.length})</h2>
          </div>
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className={cn(
                'flex items-start justify-between px-3 py-2.5 rounded-lg bg-slate-50',
                'text-sm text-slate-600'
              )}>
                <div>
                  <p className="font-medium text-slate-800 text-xs truncate max-w-xs">
                    {s.user_agent || 'Bilinmeyen tarayıcı'}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {s.ip || '—'} · {new Date(s.created_at).toLocaleString('tr-TR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
