import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Database, FileText, Home, LogOut, Plus, Menu, X, BarChart2, Users, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

  const Sidebar = (
    <aside className={cn(
      'fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200',
      'lg:relative lg:translate-x-0',
      sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
    )}>
      {/* Logo + user info */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-600 rounded-lg p-1.5 shrink-0">
            <BarChart2 className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-gray-900 leading-tight">QueryCraft</h1>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>

        {/* Role badge */}
        <div className="mt-3">
          {isAdmin ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
              <Shield className="h-3 w-3" /> Admin
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
              <FileText className="h-3 w-3" /> Viewer
            </span>
          )}
        </div>

        {/* Close button (mobile only) */}
        <button
          className="absolute top-4 right-4 lg:hidden text-gray-400 hover:text-gray-600"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to))
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="p-3 border-t border-gray-100 space-y-2">
        {isAdmin && (
          <Button className="w-full" size="sm" onClick={() => { navigate('/reports/new'); setSidebarOpen(false) }}>
            <Plus className="h-4 w-4" /> New Report
          </Button>
        )}
        <Button variant="ghost" size="sm" className="w-full text-gray-500" onClick={handleLogout}>
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {Sidebar}

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:text-gray-700">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 rounded-md p-1">
              <BarChart2 className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">QueryCraft</span>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-4 sm:p-6">{children}</div>
      </main>
    </div>
  )
}
