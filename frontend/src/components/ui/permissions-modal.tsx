import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { adminService, type ReportPermission } from '@/services/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { X, UserMinus, UserPlus, Users } from 'lucide-react'

interface Props {
  reportId: string
  reportName: string
  open: boolean
  onClose: () => void
}

function initials(email: string): string {
  return email.slice(0, 2).toUpperCase()
}

export function PermissionsModal({ reportId, reportName, open, onClose }: Props) {
  const [permissions, setPermissions] = useState<ReportPermission[]>([])
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    adminService.getPermissions(reportId)
      .then((r) => setPermissions(r.data.data.permissions))
      .finally(() => setLoading(false))
  }, [open, reportId])

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setAdding(true); setAddError('')
    try {
      await adminService.grantPermission(reportId, email.trim())
      const r = await adminService.getPermissions(reportId)
      setPermissions(r.data.data.permissions)
      setEmail('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setAddError(msg || 'User not found or already has access.')
    } finally {
      setAdding(false)
    }
  }

  async function handleRevoke(userId: string) {
    setRevoking(userId)
    try {
      await adminService.revokePermission(reportId, userId)
      setPermissions((p) => p.filter((x) => x.id !== userId))
    } finally {
      setRevoking(null)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-xl shadow-xl p-0 overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-gray-100">
            <div>
              <Dialog.Title className="text-base font-semibold text-gray-900">Manage Access</Dialog.Title>
              <Dialog.Description className="text-sm text-gray-500 mt-0.5 truncate max-w-xs">{reportName}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600 transition-colors ml-4 mt-0.5">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Current access list */}
          <div className="p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              <Users className="h-3.5 w-3.5 inline mr-1.5" />
              Current Access
            </p>

            {loading ? (
              <div className="flex justify-center py-6">
                <Spinner className="h-5 w-5" />
              </div>
            ) : permissions.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No viewers have access yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {permissions.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {initials(p.email)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{p.email}</p>
                        <p className="text-xs text-gray-400 capitalize">{p.role}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevoke(p.id)}
                      disabled={revoking === p.id}
                      className="text-gray-400 hover:text-red-500 transition-colors shrink-0 disabled:opacity-50"
                      title="Revoke access"
                    >
                      {revoking === p.id ? <Spinner className="h-4 w-4" /> : <UserMinus className="h-4 w-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add user */}
          <div className="px-5 pb-5">
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                <UserPlus className="h-3.5 w-3.5 inline mr-1.5" />
                Grant Access by Email
              </p>
              <form onSubmit={handleGrant} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="viewer@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setAddError('') }}
                  className="flex-1"
                />
                <Button type="submit" size="sm" disabled={adding || !email.trim()}>
                  {adding ? <Spinner className="h-4 w-4" /> : 'Add'}
                </Button>
              </form>
              {addError && <p className="text-xs text-red-500 mt-1.5">{addError}</p>}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
