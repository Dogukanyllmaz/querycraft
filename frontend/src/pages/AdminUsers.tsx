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
import { UserPlus, Trash2, Shield, Eye, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

function RoleBadge({ role }: { role: 'admin' | 'viewer' }) {
  return role === 'admin' ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
      <Shield className="h-3 w-3" /> Admin
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
      <Eye className="h-3 w-3" /> Viewer
    </span>
  )
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
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

  useEffect(() => {
    load()
  }, [])

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
    if (addForm.password.length < 8) {
      setAddError('Password must be at least 8 characters.')
      return
    }
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
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Users</h2>
          <p className="text-gray-500 mt-1">Manage user accounts and roles.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4" /> Add User
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-gray-400">
                  <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No users yet. Click "Add User" to get started.</p>
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {u.email.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.email}</p>
                        {isSelf(u) && <p className="text-xs text-gray-400">You</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm">
                    {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSelf(u) || togglingRole === u.id}
                        onClick={() => handleRoleToggle(u)}
                        title={isSelf(u) ? "You can't change your own role" : `Switch to ${u.role === 'admin' ? 'Viewer' : 'Admin'}`}
                        className="text-xs"
                      >
                        {togglingRole === u.id
                          ? <Spinner className="h-3.5 w-3.5" />
                          : u.role === 'admin' ? 'Make Viewer' : 'Make Admin'}
                      </Button>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={isSelf(u) || deleting === u.id}
                        title={isSelf(u) ? "You can't delete your own account" : 'Delete user'}
                        className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {deleting === u.id ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      <Dialog.Root open={addOpen} onOpenChange={(v) => { if (!v) { setAddOpen(false); setAddError('') } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-white rounded-xl shadow-xl p-0 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <Dialog.Title className="text-base font-semibold text-gray-900">Add User</Dialog.Title>
              <Dialog.Close asChild>
                <button className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>

            <form onSubmit={handleAddUser} className="p-5 space-y-4">
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
                <div className="flex gap-3">
                  {(['viewer', 'admin'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setAddForm((f) => ({ ...f, role: r }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        addForm.role === r
                          ? r === 'admin'
                            ? 'bg-blue-50 border-blue-400 text-blue-700'
                            : 'bg-gray-100 border-gray-400 text-gray-700'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {r === 'admin' ? <Shield className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
