import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface OrgInfo {
  id: string
  name: string
  created_at: string
}

interface Counts {
  students: number
  teachers: number
  groups: number
}

interface RecentPayment {
  month: string
  status: string
  amount: number
  studentName: string
}

function subscriptionStatus(createdAt: string): 'trial' | 'active' {
  const daysSince = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  return daysSince <= 14 ? 'trial' : 'active'
}

export default function OrgDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [counts, setCounts] = useState<Counts>({ students: 0, teachers: 0, groups: 0 })
  const [payments, setPayments] = useState<RecentPayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) fetchAll(id)
  }, [id])

  async function fetchAll(orgId: string) {
    setLoading(true)

    const [
      { data: orgData },
      { data: students },
      { data: teachers },
      { data: groups },
      { data: payData },
    ] = await Promise.all([
      supabase.from('organizations').select('id, name, created_at').eq('id', orgId).single(),
      supabase.from('students').select('id', { count: 'exact' }).eq('org_id', orgId),
      supabase.from('teachers').select('id', { count: 'exact' }).eq('org_id', orgId),
      supabase.from('groups').select('id', { count: 'exact' }).eq('org_id', orgId),
      supabase
        .from('payments')
        .select('month, status, amount, student_id')
        .eq('org_id', orgId)
        .order('month', { ascending: false })
        .limit(10),
    ])

    setOrg(orgData ?? null)
    setCounts({
      students: students?.length ?? 0,
      teachers: teachers?.length ?? 0,
      groups: groups?.length ?? 0,
    })

    // Fetch student names for recent payments
    const studentIds = [...new Set((payData ?? []).map((p) => p.student_id))]
    let nameMap: Record<string, string> = {}
    if (studentIds.length > 0) {
      const { data: studentData } = await supabase
        .from('students')
        .select('id, full_name')
        .in('id', studentIds)
      ;(studentData ?? []).forEach((s) => { nameMap[s.id] = s.full_name })
    }

    setPayments(
      (payData ?? []).map((p) => ({
        month: p.month,
        status: p.status,
        amount: p.amount,
        studentName: nameMap[p.student_id] ?? '—',
      }))
    )

    setLoading(false)
  }

  if (loading) return <p className="text-gray-400">Yuklanmoqda...</p>
  if (!org) return <p className="text-gray-400">Tashkilot topilmadi.</p>

  const status = subscriptionStatus(org.created_at)

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/superadmin/dashboard')}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Orqaga
        </button>
        <h1 className="text-2xl font-bold text-gray-800">{org.name}</h1>
      </div>

      {/* Org info */}
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Tashkilot ma'lumotlari</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Nomi</p>
            <p className="font-medium text-gray-800">{org.name}</p>
          </div>
          <div>
            <p className="text-gray-500">Ro'yxatdan o'tgan</p>
            <p className="font-medium text-gray-800">{new Date(org.created_at).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-gray-500">Obuna holati</p>
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {status === 'active' ? 'Active' : 'Trial'}
            </span>
          </div>
        </div>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="O'quvchilar" value={counts.students} />
        <StatCard label="O'qituvchilar" value={counts.teachers} />
        <StatCard label="Guruhlar" value={counts.groups} />
      </div>

      {/* Recent payments */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">So'nggi to'lovlar</h2>
        </div>
        {payments.length === 0 ? (
          <p className="text-gray-400 text-sm px-4 py-4">To'lovlar yo'q.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">O'quvchi</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Oy</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium">Holat</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-medium">Miqdor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800 font-medium">{p.studentName}</td>
                    <td className="px-4 py-3 text-gray-600">{p.month}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          p.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {p.status === 'paid' ? "To'ladi" : "To'lamadi"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-800 font-medium">
                      {p.amount.toLocaleString()} so'm
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-800">{value}</p>
    </div>
  )
}
