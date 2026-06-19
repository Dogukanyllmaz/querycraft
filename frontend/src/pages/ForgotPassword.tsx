import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authService } from '@/services/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { BarChart2, ArrowLeft, CheckCircle2 } from 'lucide-react'

export function ForgotPassword() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authService.forgotPassword(email)
      setSent(true)
    } catch {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
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

        {sent ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <p className="text-sm text-green-800">
                Eğer <strong>{email}</strong> sistemde kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.
                Lütfen gelen kutunuzu kontrol edin.
              </p>
            </div>
            <Link to="/login" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
              <ArrowLeft className="h-4 w-4" /> Giriş sayfasına dön
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Şifremi Unuttum</h2>
              <p className="text-slate-500 text-sm">
                E-posta adresinizi girin, size sıfırlama bağlantısı gönderelim.
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-posta adresi</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="siz@firma.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  autoFocus
                />
              </div>

              <Button type="submit" className="w-full h-10" disabled={loading}>
                {loading ? <Spinner className="h-4 w-4" /> : 'Sıfırlama Bağlantısı Gönder'}
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
