import { useState, useEffect, useCallback } from 'react'
import { adminService, type Group, type GroupMember } from '@/services/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Plus, Trash2, UserPlus, X, Users } from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────────────

function GroupMemberList({
  groupId,
  members,
  onRemove,
}: {
  groupId: string
  members: GroupMember[]
  onRemove: (userId: string) => void
}) {
  const [userId, setUserId] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError]   = useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!userId.trim()) return
    setAdding(true); setError('')
    try {
      await adminService.addGroupMember(groupId, userId.trim())
      setUserId('')
      onRemove('__refresh__') // signal parent to reload
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Kullanıcı eklenemedi')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-3">
      {members.length === 0 ? (
        <p className="text-sm text-slate-400 py-2">Henüz üye yok.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-slate-800">{m.display_name || m.email}</p>
                <p className="text-xs text-slate-400">{m.email} · {m.role}</p>
              </div>
              <button
                onClick={() => onRemove(m.id)}
                className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex gap-2 pt-1">
        <Input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Kullanıcı ID (UUID)"
          className="flex-1 text-xs"
        />
        <Button type="submit" size="sm" disabled={adding}>
          {adding ? <Spinner className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        </Button>
      </form>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function AdminGroups() {
  const [groups, setGroups]     = useState<Group[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [members, setMembers]   = useState<GroupMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)

  // Create form
  const [newName, setNewName]   = useState('')
  const [newDesc, setNewDesc]   = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const loadGroups = useCallback(async () => {
    try {
      const res = await adminService.listGroups()
      setGroups(res.data.data.groups)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadGroups() }, [loadGroups])

  useEffect(() => {
    if (!selected) return
    setMembersLoading(true)
    adminService.getGroup(selected)
      .then((res) => setMembers(res.data.data.members))
      .finally(() => setMembersLoading(false))
  }, [selected])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      await adminService.createGroup(newName, newDesc)
      setNewName(''); setNewDesc('')
      loadGroups()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setCreateError(msg || 'Grup oluşturulamadı')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu grubu silmek istediğinizden emin misiniz?')) return
    await adminService.deleteGroup(id)
    if (selected === id) setSelected(null)
    loadGroups()
  }

  async function handleRemoveMember(userId: string) {
    if (userId === '__refresh__') {
      if (selected) {
        const res = await adminService.getGroup(selected)
        setMembers(res.data.data.members)
      }
      return
    }
    await adminService.removeGroupMember(selected!, userId)
    setMembers((prev) => prev.filter((m) => m.id !== userId))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Grup Yönetimi</h1>
        <p className="text-slate-500 text-sm mt-1">
          Gruplar aracılığıyla birden fazla kullanıcıya aynı anda rapor erişimi verebilirsiniz.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Groups list */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />
              <h2 className="font-semibold text-slate-900">Gruplar</h2>
            </div>
            <span className="text-xs text-slate-400">{groups.length} grup</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner className="h-5 w-5 text-blue-500" />
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">Henüz grup yok.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {groups.map((g) => (
                <li
                  key={g.id}
                  onClick={() => setSelected(g.id)}
                  className={`flex items-center justify-between px-5 py-3 cursor-pointer transition-colors
                    ${selected === g.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                >
                  <div>
                    <p className={`font-medium text-sm ${selected === g.id ? 'text-blue-700' : 'text-slate-800'}`}>
                      {g.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {(g as Group & { member_count?: number }).member_count ?? 0} üye
                      {g.description ? ` · ${g.description}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(g.id) }}
                    className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Create group form */}
          <div className="px-5 py-4 border-t border-slate-100">
            <form onSubmit={handleCreate} className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Yeni Grup</p>
              {createError && (
                <Alert variant="destructive">
                  <AlertDescription className="text-xs">{createError}</AlertDescription>
                </Alert>
              )}
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Grup adı"
                required
              />
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Açıklama (isteğe bağlı)"
              />
              <Button type="submit" size="sm" disabled={creating} className="w-full">
                {creating ? <Spinner className="h-4 w-4" /> : <><Plus className="h-4 w-4 mr-1" />Grup Oluştur</>}
              </Button>
            </form>
          </div>
        </div>

        {/* Members panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">
              {selected ? `${groups.find((g) => g.id === selected)?.name} — Üyeler` : 'Üyeler'}
            </h2>
          </div>
          <div className="px-5 py-4">
            {!selected ? (
              <p className="text-sm text-slate-400">Üyeleri görmek için sol taraftan bir grup seçin.</p>
            ) : membersLoading ? (
              <div className="flex justify-center py-6">
                <Spinner className="h-5 w-5 text-blue-500" />
              </div>
            ) : (
              <GroupMemberList
                groupId={selected}
                members={members}
                onRemove={handleRemoveMember}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
