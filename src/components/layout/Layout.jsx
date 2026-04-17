import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, FileText, Calendar,
  Globe, ScrollText, LogOut, Zap, X, Menu, Link
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'

const nav = [
  { to: '/',          icon: LayoutDashboard, label: 'ダッシュボード', end: true },
  { to: '/accounts',  icon: Users,           label: 'アカウント' },
  { to: '/templates', icon: FileText,         label: 'テンプレート' },
  { to: '/schedules', icon: Calendar,         label: 'スケジュール' },
  { to: '/proxies',   icon: Globe,            label: 'プロキシ' },
  { to: '/urls',      icon: Link,             label: 'URL管理' },
  { to: '/logs',      icon: ScrollText,       label: '投稿ログ' },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ページ遷移時にサイドバーを閉じる
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">

      {/* ── モバイル：オーバーレイ ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── サイドバー ── */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-[240px] flex flex-col bg-gray-900 border-r border-gray-800
        transition-transform duration-300 ease-in-out
        lg:static lg:translate-x-0 lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-semibold text-gray-100 tracking-tight">ThreadsAuto</span>
          </div>
          {/* モバイル：閉じるボタン */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                 ${isActive
                   ? 'bg-brand-600/20 text-brand-400'
                   : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`
              }
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-gray-800 shrink-0">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
            <div className="w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition-colors shrink-0">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── メインエリア ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* モバイル：トップバー */}
        <header className="lg:hidden flex items-center justify-between px-4 h-14 bg-gray-900 border-b border-gray-800 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-brand-600 flex items-center justify-center">
              <Zap size={13} className="text-white" />
            </div>
            <span className="font-semibold text-gray-100 text-sm">ThreadsAuto</span>
          </div>
          <div className="w-9" /> {/* バランス用スペーサー */}
        </header>

        {/* コンテンツ */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 pb-20 lg:pb-8">
            <Outlet />
          </div>
        </main>

        {/* モバイル：ボトムナビ */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-gray-900 border-t border-gray-800 flex">
          {nav.slice(0, 5).map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2 px-1 text-center transition-colors
                 ${isActive ? 'text-brand-400' : 'text-gray-600'}`
              }
            >
              <Icon size={18} />
              <span className="text-[10px] font-medium leading-tight">{label.length > 5 ? label.slice(0, 5) : label}</span>
            </NavLink>
          ))}
          {/* その他（投稿ログ）はハンバーガーメニューから */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 px-1 text-gray-600"
          >
            <Menu size={18} />
            <span className="text-[10px] font-medium">メニュー</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
