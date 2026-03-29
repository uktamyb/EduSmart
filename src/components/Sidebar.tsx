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
]

export default function Sidebar() {
  async function handleSignOut() {
    await supabase.auth.signOut()
    // navigation handled by useAuth onAuthStateChange (SIGNED_OUT event)
  }

  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-700">
        <span className="text-lg font-bold tracking-wide">EduSmart</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block px-3 py-2 rounded text-sm font-medium transition-colors ${
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
          className="w-full text-left text-sm text-gray-400 hover:text-white transition-colors px-3 py-2 rounded hover:bg-gray-700"
        >
          Sign Out
        </button>
      </div>
    </aside>
  )
}
