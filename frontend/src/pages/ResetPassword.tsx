import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authService } from '@/services/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { BarChart2, ArrowLeft, CheckCircle2 } from 'lucide-react'

export function ResetPassword() {
  const [searchParams]        = useSearchParams()
  const navigate              = useNavigate()
  const token                 = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword]       = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]               = useState(false)
  const [done, setDone]                     = useState(false)
  const [error, setError]                   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Şifreler eşleşmiyor.')
      return
    }

    setLoading(true)
    try {
      await authService.resetPassword(token, newPassword)
      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Geçersiz veya süresi dolmuş bağlantı.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center space-y-4">
          <p className="text-slate-600">Geçersiz sıfırlama bağlantısı.</p>
          <Link to="/forgot-password" className="text-blue-600 hover:underline text-sm">
            Yeni bağlantı iste
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm space-y-7">
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-500 rounded-md p-1.5">
            <BarChart2 className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-slate-900">QueryCraft</span>
        </div>

        {done ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <p className="text-sm text-green-800">
                Şifreniz başarıyla güncellendi. Giriş sayfasına yönlendiriliyorsunuz...
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Yeni Şifre</h2>
              <p className="text-slate-500 text-sm">Hesabınız için yeni bir şifre belirleyin.</p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Yeni şifre</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="En az 8 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm">Şifre tekrar</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Şifreyi tekrar girin"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <Button type="submit" className="w-full h-10" disabled={loading}>
                {loading ? <Spinner className="h-4 w-4" /> : 'Şifremi Güncelle'}
              </Button>
            </form>

            <Link to="/login" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="h-4 w-4" /> Giriş sayfasına dön
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
