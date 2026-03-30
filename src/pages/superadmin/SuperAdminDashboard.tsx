import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface OrgRow {
  id: string
  name: string
  created_at: string
  ownerName: string
  studentCount: number
  subscriptionStatus: 'trial' | 'active'
}

function subscriptionStatus(createdAt: string): 'trial' | 'active' {
  const daysSince = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  return daysSince <= 14 ? 'trial' : 'active'
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)

    const [
      { data: orgData },
      { data: userData },
      { data: studentData },
      { data: paymentData },
    ] = await Promise.all([
      supabase.from('organizations').select('id, name, created_at').order('created_at', { ascending: false }),
      supabase.from('users').select('org_id, full_name, role'),
      supabase.from('students').select('org_id'),
      supabase.from('payments').select('amount').eq('status', 'paid'),
    ])

    const studentCountByOrg: Record<string, number> = {}
    ;(studentData ?? []).forEach((s) => {
      studentCountByOrg[s.org_id] = (studentCountByOrg[s.org_id] ?? 0) + 1
    })

    const ownerByOrg: Record<string, string> = {}
    ;(userData ?? []).forEach((u) => {
      if (!ownerByOrg[u.org_id]) ownerByOrg[u.org_id] = u.full_name
    })

    const rows: OrgRow[] = (orgData ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      created_at: o.created_at,
      ownerName: ownerByOrg[o.id] ?? '—',
      studentCount: studentCountByOrg[o.id] ?? 0,
      subscriptionStatus: subscriptionStatus(o.created_at),
    }))

    setOrgs(rows)
    setTotalStudents(studentData?.length ?? 0)
    setTotalRevenue((paymentData ?? []).reduce((sum, p) => sum + p.amount, 0))
    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Super Admin Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Tashkilotlar" value={orgs.length} />
        <StatCard label="Jami o'quvchilar" value={totalStudents} />
        <StatCard label="Jami daromad" value={`${totalRevenue.toLocaleString()} so'm`} />
      </div>

      {/* Orgs table */}
      {loading ? (
        <p className="text-gray-400">Yuklanmoqda...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Tashkilotlar</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">#</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Tashkilot nomi</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Egasi</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Sana</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium">O'quvchilar</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium">Obuna</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {orgs.map((org, i) => (
                  <tr key={org.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 text-gray-800 font-medium">{org.name}</td>
                    <td className="px-4 py-3 text-gray-600">{org.ownerName}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(org.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-800 font-medium">
                      {org.studentCount}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          org.subscriptionStatus === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {org.subscriptionStatus === 'active' ? 'Active' : 'Trial'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => navigate(`/superadmin/orgs/${org.id}`)}
                        className="text-purple-600 hover:underline text-xs"
                      >
                        Ko'rish
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  )
}
