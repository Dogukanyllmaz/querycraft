import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { adminService } from '@/services/admin'
import { useAuth } from '@/context/AuthContext'
import type { User } from '@/services/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { UserPlus, Trash2, Shield, Eye, X, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

function RoleBadge({ role }: { role: 'admin' | 'viewer' }) {
  return role === 'admin' ? (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-600/15">
      <Shield className="h-3 w-3" /> Admin
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-500 ring-1 ring-slate-500/10">
      <Eye className="h-3 w-3" /> Viewer
    </span>
  )
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-50">
      {[160, 80, 100, 120].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 rounded-md animate-shimmer" style={{ width: w }} />
        </td>
      ))}
    </tr>
  )
}

export function AdminUsers() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [togglingRole, setTogglingRole] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ email: '', password: '', role: 'viewer' as 'admin' | 'viewer' })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => { load() }, [])

  function load() {
    setLoading(true)
    adminService.listUsers()
      .then((r) => setUsers(r.data.data.users))
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoading(false))
  }

  async function handleRoleToggle(u: User) {
    const newRole = u.role === 'admin' ? 'viewer' : 'admin'
    setTogglingRole(u.id)
    try {
      const r = await adminService.updateUserRole(u.id, newRole)
      setUsers((prev) => prev.map((x) => x.id === u.id ? r.data.data.user : x))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Failed to update role.')
    } finally {
      setTogglingRole(null)
    }
  }

  async function handleDelete(u: User) {
    if (!confirm(`Delete ${u.email}? This cannot be undone.`)) return
    setDeleting(u.id)
    try {
      await adminService.deleteUser(u.id)
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Failed to delete user.')
    } finally {
      setDeleting(null)
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    if (addForm.password.length < 8) { setAddError('Password must be at least 8 characters.'); return }
    setAdding(true); setAddError('')
    try {
      const r = await adminService.createUser(addForm.email, addForm.password, addForm.role)
      setUsers((prev) => [...prev, r.data.data.user])
      setAddOpen(false)
      setAddForm({ email: '', password: '', role: 'viewer' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setAddError(msg || 'Failed to create user.')
    } finally {
      setAdding(false)
    }
  }

  const isSelf = (u: User) => u.id === currentUser?.id

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Users</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage team accounts and roles.</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="shrink-0">
          <UserPlus className="h-4 w-4" /> Add User
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Joined</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="flex flex-col items-center py-14 gap-3 text-slate-400">
                    <div className="bg-slate-50 rounded-full p-4">
                      <UserPlus className="h-6 w-6 opacity-50" />
                    </div>
                    <p className="text-sm font-medium">No users yet</p>
                    <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                      Add the first user
                    </Button>
                  </div>
                </td>
              </tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0 ring-1 ring-blue-100">
                      {u.email.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate text-sm">{u.email}</p>
                      {isSelf(u) && <p className="text-xs text-slate-400">You</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-4 py-3.5 hidden sm:table-cell">
                  <span className="text-xs text-slate-400">
                    {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSelf(u) || togglingRole === u.id}
                      onClick={() => handleRoleToggle(u)}
                      title={isSelf(u) ? "You can't change your own role" : undefined}
                      className="text-xs h-7"
                    >
                      {togglingRole === u.id
                        ? <Spinner className="h-3 w-3" />
                        : <><ChevronRight className="h-3 w-3" />{u.role === 'admin' ? 'Make Viewer' : 'Make Admin'}</>
                      }
                    </Button>
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={isSelf(u) || deleting === u.id}
                      title={isSelf(u) ? "You can't delete your own account" : 'Delete user'}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {deleting === u.id ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Add User Modal */}
      <Dialog.Root open={addOpen} onOpenChange={(v) => { if (!v) { setAddOpen(false); setAddError('') } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
              <div>
                <Dialog.Title className="text-base font-semibold text-slate-900">Add User</Dialog.Title>
                <Dialog.Description className="text-xs text-slate-400 mt-0.5">Create a new team account</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <form onSubmit={handleAddUser} className="px-5 py-5 space-y-4">
              {addError && (
                <Alert variant="destructive">
                  <AlertDescription>{addError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="user@company.com"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-password">Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={addForm.password}
                  onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Role</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['viewer', 'admin'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setAddForm((f) => ({ ...f, role: r }))}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-sm font-medium transition-all duration-150 ${
                        addForm.role === r
                          ? r === 'admin'
                            ? 'bg-blue-50 border-blue-400 text-blue-700 ring-1 ring-blue-400/30'
                            : 'bg-slate-100 border-slate-400 text-slate-700 ring-1 ring-slate-400/30'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      {r === 'admin' ? <Shield className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={adding}>
                {adding ? <Spinner className="h-4 w-4" /> : 'Create User'}
              </Button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
