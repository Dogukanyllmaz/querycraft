import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { BarChart2, ArrowRight } from 'lucide-react'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] bg-slate-900 flex-col justify-between p-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 rounded-lg p-2 shadow-lg shadow-blue-500/30">
            <BarChart2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">QueryCraft</span>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Enterprise<br />reporting,<br />
            <span className="text-blue-400">simplified.</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-xs">
            Build powerful SQL reports with a visual wizard — no code required.
            Share insights with your team instantly.
          </p>
        </div>

        <div className="space-y-3">
          {[
            'Visual SQL query builder',
            'Bar, line, area & donut charts',
            'Role-based access control',
            'Export to CSV & Excel',
          ].map((f) => (
            <div key={f} className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
              <p className="text-slate-400 text-sm">{f}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm space-y-7">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="bg-blue-500 rounded-md p-1.5">
              <BarChart2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">QueryCraft</span>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h2>
            <p className="text-slate-500 text-sm">Sign in to your account to continue.</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <Button type="submit" className="w-full h-10" disabled={loading}>
              {loading
                ? <Spinner className="h-4 w-4" />
                : <><span>Sign In</span><ArrowRight className="h-4 w-4" /></>
              }
            </Button>
          </form>

          <div className="flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="text-slate-500 hover:text-slate-700">
              Şifremi unuttum
            </Link>
            <Link to="/signup" className="text-blue-600 font-medium hover:underline">
              İlk kurulum
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
