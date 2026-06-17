import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { authService } from '@/services/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { BarChart2, Lock, ArrowRight, ShieldCheck } from 'lucide-react'

export function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null)

  useEffect(() => {
    authService.setupStatus()
      .then((r) => setRegistrationOpen(r.data.data.registrationOpen))
      .catch(() => setRegistrationOpen(false))
      .finally(() => setChecking(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      await signup(email, password)
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Sign up failed. Please try again.')
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
            First setup.<br />
            <span className="text-blue-400">Admin account.</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-xs">
            Create the first administrator account to unlock full access to connections, reports, and user management.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-slate-400 text-sm leading-relaxed">
              After this first account is created, registration is locked. New users can only be added by an administrator.
            </p>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 lg:hidden mb-8">
            <div className="bg-blue-500 rounded-md p-1.5">
              <BarChart2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">QueryCraft</span>
          </div>

          {checking ? (
            <div className="flex justify-center py-16">
              <Spinner className="h-6 w-6" />
            </div>
          ) : registrationOpen === false ? (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="bg-slate-100 rounded-full p-5">
                  <Lock className="h-8 w-8 text-slate-400" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">Registration Closed</h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  New accounts can only be created by an administrator.<br />
                  Contact your admin to get access.
                </p>
              </div>
              <Link to="/login">
                <Button variant="outline" className="w-full">Back to Sign In</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-7">
              <div className="space-y-1.5">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Create admin account</h2>
                <p className="text-slate-500 text-sm">This will be the first and primary administrator.</p>
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
                    placeholder="admin@company.com"
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
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Repeat your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <Button type="submit" className="w-full h-10" disabled={loading}>
                  {loading
                    ? <Spinner className="h-4 w-4" />
                    : <><span>Create Admin Account</span><ArrowRight className="h-4 w-4" /></>
                  }
                </Button>
              </form>

              <p className="text-center text-sm text-slate-500">
                Already have an account?{' '}
                <Link to="/login" className="text-blue-600 font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
