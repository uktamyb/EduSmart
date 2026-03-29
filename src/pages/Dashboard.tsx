import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

interface Stats {
  students: number
  teachers: number
  groups: number
  revenue: number
}

interface AttendanceSummary {
  present: number
  absent: number
}

interface RecentPayment {
  id: string
  student_name: string
  amount: number
  status: string
  month: string
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function Dashboard() {
  const { org } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null)
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const orgId = org?.id
    if (!orgId) return
    fetchAll(orgId)
  }, [org?.id])

  async function fetchAll(orgId: string) {
    setLoading(true)
    await Promise.all([
      fetchStats(orgId),
      fetchAttendance(orgId),
      fetchRecentPayments(orgId),
    ])
    setLoading(false)
  }

  async function fetchStats(orgId: string) {
    const [students, teachers, groups, revenue] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('groups').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('payments').select('amount').eq('org_id', orgId).eq('month', currentMonth()).eq('status', 'paid'),
    ])

    const totalRevenue = (revenue.data ?? []).reduce((sum, p) => sum + p.amount, 0)

    setStats({
      students: students.count ?? 0,
      teachers: teachers.count ?? 0,
      groups: groups.count ?? 0,
      revenue: totalRevenue,
    })
  }

  async function fetchAttendance(orgId: string) {
    const { data } = await supabase
      .from('attendance')
      .select('status')
      .eq('org_id', orgId)
      .eq('date', today())

    if (data) {
      const present = data.filter((r) => r.status === 'present').length
      const absent = data.filter((r) => r.status === 'absent').length
      setAttendance({ present, absent })
    }
  }

  async function fetchRecentPayments(orgId: string) {
    const { data } = await supabase
      .from('payments')
      .select('id, amount, status, month, students(full_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (data) {
      setRecentPayments(
        (data as unknown as { id: string; amount: number; status: string; month: string; students: { full_name: string } | null }[]).map(
          (p) => ({
            id: p.id,
            student_name: p.students?.full_name ?? '—',
            amount: p.amount,
            status: p.status,
            month: p.month,
          })
        )
      )
    }
  }

  const quickLinks = [
    { label: "O'quvchilar", to: '/students', color: 'bg-blue-500' },
    { label: "O'qituvchilar", to: '/teachers', color: 'bg-purple-500' },
    { label: 'Guruhlar', to: '/groups', color: 'bg-green-500' },
    { label: 'Davomat', to: '/attendance', color: 'bg-yellow-500' },
    { label: "To'lovlar", to: '/payments', color: 'bg-orange-500' },
    { label: 'Baholar', to: '/grades', color: 'bg-red-500' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        {org && <p className="text-gray-500 text-sm mt-1">{org.name}</p>}
      </div>

      {loading ? (
        <p className="text-gray-400">Yuklanmoqda...</p>
      ) : (
        <div className="space-y-6">

          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="O'quvchilar"
              value={stats?.students ?? 0}
              unit="ta"
              color="text-blue-600"
              bg="bg-blue-50"
              onClick={() => navigate('/students')}
            />
            <StatCard
              label="O'qituvchilar"
              value={stats?.teachers ?? 0}
              unit="ta"
              color="text-purple-600"
              bg="bg-purple-50"
              onClick={() => navigate('/teachers')}
            />
            <StatCard
              label="Guruhlar"
              value={stats?.groups ?? 0}
              unit="ta"
              color="text-green-600"
              bg="bg-green-50"
              onClick={() => navigate('/groups')}
            />
            <StatCard
              label="Bu oylik tushum"
              value={(stats?.revenue ?? 0).toLocaleString()}
              unit="so'm"
              color="text-orange-600"
              bg="bg-orange-50"
              onClick={() => navigate('/payments')}
            />
          </div>

          {/* Attendance + Recent payments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Today's attendance */}
            <div className="bg-white rounded-lg shadow p-5">
              <h2 className="text-base font-semibold text-gray-700 mb-4">
                Bugungi davomat
              </h2>
              {attendance && (attendance.present + attendance.absent) === 0 ? (
                <p className="text-gray-400 text-sm">Bugun davomat olinmagan.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Keldi</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-green-400" style={{ width: `${attendance && (attendance.present + attendance.absent) > 0 ? Math.round((attendance.present / (attendance.present + attendance.absent)) * 120) : 0}px` }} />
                      <span className="text-sm font-semibold text-green-600">{attendance?.present ?? 0}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Kelmadi</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-red-400" style={{ width: `${attendance && (attendance.present + attendance.absent) > 0 ? Math.round((attendance.absent / (attendance.present + attendance.absent)) * 120) : 0}px` }} />
                      <span className="text-sm font-semibold text-red-500">{attendance?.absent ?? 0}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 pt-1">
                    Jami: {(attendance?.present ?? 0) + (attendance?.absent ?? 0)} ta qayd
                  </p>
                </div>
              )}
            </div>

            {/* Recent payments */}
            <div className="bg-white rounded-lg shadow p-5">
              <h2 className="text-base font-semibold text-gray-700 mb-4">
                So'nggi to'lovlar
              </h2>
              {recentPayments.length === 0 ? (
                <p className="text-gray-400 text-sm">Hali to'lovlar yo'q.</p>
              ) : (
                <ul className="space-y-2">
                  {recentPayments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-gray-800">{p.student_name}</span>
                        <span className="text-gray-400 ml-2">{p.month}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-700">{p.amount.toLocaleString()} so'm</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-600'
                        }`}>
                          {p.status === 'paid' ? "To'ladi" : "To'lamadi"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-base font-semibold text-gray-700 mb-4">Tezkor o'tish</h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {quickLinks.map((link) => (
                <button
                  key={link.to}
                  onClick={() => navigate(link.to)}
                  className={`${link.color} text-white text-xs font-medium rounded-lg py-3 px-2 hover:opacity-90 transition-opacity text-center`}
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  unit,
  color,
  bg,
  onClick,
}: {
  label: string
  value: number | string
  unit: string
  color: string
  bg: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`${bg} rounded-lg p-5 text-left hover:opacity-90 transition-opacity w-full`}
    >
      <p className="text-xs text-gray-500 font-medium mb-2">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>
        {value}
        <span className="text-sm font-normal ml-1 text-gray-400">{unit}</span>
      </p>
    </button>
  )
}
