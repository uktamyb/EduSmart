import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/students', label: "O'quvchilar" },
  { to: '/teachers', label: "O'qituvchilar" },
  { to: '/subjects', label: 'Fanlar' },
  { to: '/groups', label: 'Guruhlar' },
  { to: '/attendance', label: 'Davomat' },
  { to: '/payments', label: "To'lovlar" },
  { to: '/grades', label: 'Baholar' },
  { to: '/analytics', label: 'Tahlil' },
]

interface Props {
  onClose: () => void
}

export default function Sidebar({ onClose }: Props) {
  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <aside className="w-56 h-full min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-700 flex items-center justify-between">
        <span className="text-lg font-bold tracking-wide">EduSmart</span>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden text-gray-400 hover:text-white p-1"
          aria-label="Close menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center min-h-[44px] px-3 py-2 rounded text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-gray-700">
        <button
          onClick={handleSignOut}
          className="w-full text-left text-sm text-gray-400 hover:text-white transition-colors px-3 py-3 min-h-[44px] rounded hover:bg-gray-700 flex items-center"
        >
          Sign Out
        </button>
      </div>
    </aside>
  )
}
