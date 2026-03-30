import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import Teachers from './pages/Teachers'
import Subjects from './pages/Subjects'
import Groups from './pages/Groups'
import GroupDetail from './pages/GroupDetail'
import Attendance from './pages/Attendance'
import Payments from './pages/Payments'
import Grades from './pages/Grades'
import Analytics from './pages/Analytics'
import SuperAdminRoute from './components/SuperAdminRoute'
import SuperAdminLayout from './components/SuperAdminLayout'
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard'
import OrgDetail from './pages/superadmin/OrgDetail'
import TeacherRoute from './components/TeacherRoute'
import TeacherLayout from './components/TeacherLayout'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import TeacherAttendance from './pages/teacher/TeacherAttendance'
import TeacherGrades from './pages/teacher/TeacherGrades'

function AppRoutes() {
  useAuth()

  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout><Dashboard /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/students"
        element={
          <ProtectedRoute>
            <Layout><Students /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/teachers"
        element={
          <ProtectedRoute>
            <Layout><Teachers /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/subjects"
        element={
          <ProtectedRoute>
            <Layout><Subjects /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/groups"
        element={
          <ProtectedRoute>
            <Layout><Groups /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/groups/:id"
        element={
          <ProtectedRoute>
            <Layout><GroupDetail /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance"
        element={
          <ProtectedRoute>
            <Layout><Attendance /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/payments"
        element={
          <ProtectedRoute>
            <Layout><Payments /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/grades"
        element={
          <ProtectedRoute>
            <Layout><Grades /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Layout><Analytics /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/superadmin/dashboard"
        element={
          <SuperAdminRoute>
            <SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>
          </SuperAdminRoute>
        }
      />
      <Route
        path="/superadmin/orgs/:id"
        element={
          <SuperAdminRoute>
            <SuperAdminLayout><OrgDetail /></SuperAdminLayout>
          </SuperAdminRoute>
        }
      />

      <Route path="/teacher/dashboard" element={<TeacherRoute><TeacherLayout><TeacherDashboard /></TeacherLayout></TeacherRoute>} />
      <Route path="/teacher/attendance" element={<TeacherRoute><TeacherLayout><TeacherAttendance /></TeacherLayout></TeacherRoute>} />
      <Route path="/teacher/grades" element={<TeacherRoute><TeacherLayout><TeacherGrades /></TeacherLayout></TeacherRoute>} />

      <Route path="*" element={<Navigate to="/signin" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
