import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function TeacherRoute({ children }: { children: React.ReactNode }) {
  const { user, role, isLoading } = useAuthStore()

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
  }

  if (!user || role !== 'teacher') {
    return <Navigate to="/signin" replace />
  }

  return <>{children}</>
}
