import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, role, isLoading } = useAuthStore()

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
  }

  if (!user || role !== 'super_admin') {
    return <Navigate to="/signin" replace />
  }

  return <>{children}</>
}
