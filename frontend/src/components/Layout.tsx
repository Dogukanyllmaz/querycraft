import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  Database, FileText, Home, LogOut, Plus, Menu, X,
  BarChart2, Users, Shield, Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const adminNavItems = [
    { to: '/dashboard',   label: 'Dashboard',   icon: Home     },
    { to: '/connections', label: 'Connections', icon: Database  },
    { to: '/reports',     label: 'Reports',     icon: FileText  },
    { to: '/admin/users', label: 'Users',       icon: Users     },
  ]

  const viewerNavItems = [
    { to: '/dashboard', label: 'Dashboard', icon: Home     },
    { to: '/reports',   label: 'Reports',   icon: FileText  },
  ]

  const navItems = isAdmin ? adminNavItems : viewerNavItems

  function isActive(to: string) {
    if (to === '/dashboard') return location.pathname === '/' || location.pathname === '/dashboard'
    return location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to))
  }

  const Sidebar = (
    <aside className={cn(
      'fixed inset-y-0 left-0 z-50 w-60 bg-slate-900 flex flex-col transition-transform duration-200 ease-in-out',
      'lg:relative lg:translate-x-0',
      sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
    )}>
      {/* Brand + user */}
      <div className="px-4 pt-5 pb-4 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 rounded-lg p-1.5 shrink-0 shadow-lg shadow-blue-500/30">
            <BarChart2 className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white tracking-tight leading-tight">QueryCraft</p>
            <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</p>
          </div>
          <button
            className="lg:hidden text-slate-500 hover:text-slate-300 transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Role badge */}
        <div className="mt-3">
          {isAdmin ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/25">
              <Shield className="h-2.5 w-2.5" /> Admin
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-white/6 text-slate-400 ring-1 ring-white/8">
              <Eye className="h-2.5 w-2.5" /> Viewer
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto scrollbar-dark">
        <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
          Navigation
        </p>
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
              isActive(to)
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/6'
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', isActive(to) ? 'text-blue-400' : '')} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 pb-4 space-y-1 border-t border-white/8 pt-3">
        {isAdmin && (
          <button
            onClick={() => { navigate('/reports/new'); setSidebarOpen(false) }}
            className="w-full flex items-center justify-center gap-2 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all duration-150 shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" /> New Report
          </button>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-300 hover:bg-white/6 transition-all duration-150"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )

  return (
    <div className="min-h-dvh bg-slate-100 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {Sidebar}

      {/* Main */}
      <main className="flex-1 overflow-auto min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 bg-white border-b border-slate-200 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-blue-500 rounded-md p-1">
              <BarChart2 className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-sm">QueryCraft</span>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-5 sm:p-7 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  )
}
