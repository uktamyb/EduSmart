import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

interface RevenuePoint { month: string; revenue: number }
interface AttendancePoint { group: string; rate: number }
interface GradePoint { month: string; avg: number }
interface PaymentPoint { group: string; paid: number; unpaid: number }
interface TopStudent { name: string; value: number }

interface InsightData {
  totalStudents: number
  totalGroups: number
  monthlyRevenue: RevenuePoint[]
  attendanceRates: AttendancePoint[]
  gradesTrend: GradePoint[]
  paymentRates: PaymentPoint[]
  atRiskStudents: { name: string; absences: number }[]
  topByAttendance: TopStudent[]
  topByGrades: TopStudent[]
}

function lastNMonths(n: number): string[] {
  const months: string[] = []
  const d = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    months.push(m.toISOString().slice(0, 7))
  }
  return months
}

export default function Analytics() {
  const { org } = useAuthStore()
  const [data, setData] = useState<InsightData | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiInsight, setAiInsight] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    const orgId = org?.id
    if (!orgId) return
    fetchAll(orgId)
  }, [org?.id])

  async function fetchAll(orgId: string) {
    setLoading(true)
    const months = lastNMonths(6)
    const currentMonth = months[months.length - 1]

    const [
      { data: groups },
      { data: students },
      { data: payments },
      { data: attendance },
      { data: grades },
    ] = await Promise.all([
      supabase.from('groups').select('id, name').eq('org_id', orgId),
      supabase.from('students').select('id, full_name').eq('org_id', orgId),
      supabase.from('payments').select('month, status, amount, group_id').eq('org_id', orgId),
      supabase.from('attendance').select('date, status, student_id, group_id').eq('org_id', orgId),
      supabase.from('grades').select('date, grade, student_id').eq('org_id', orgId),
    ])

    // 1. Monthly revenue (last 6 months)
    const monthlyRevenue: RevenuePoint[] = months.map((m) => ({
      month: m.slice(5), // MM
      revenue: (payments ?? [])
        .filter((p) => p.month === m && p.status === 'paid')
        .reduce((sum, p) => sum + p.amount, 0),
    }))

    // 2. Attendance rate per group (current month)
    const currentMonthPrefix = currentMonth // YYYY-MM
    const groupList = groups ?? []
    const attendanceRates: AttendancePoint[] = groupList.map((g) => {
      const gAtt = (attendance ?? []).filter(
        (a) => a.group_id === g.id && a.date.startsWith(currentMonthPrefix)
      )
      const total = gAtt.length
      const present = gAtt.filter((a) => a.status === 'present').length
      return { group: g.name, rate: total > 0 ? Math.round((present / total) * 100) : 0 }
    })

    // 3. Average grades per month (last 6 months)
    const gradesTrend: GradePoint[] = months.map((m) => {
      const monthGrades = (grades ?? []).filter((g) => g.date.startsWith(m))
      const avg =
        monthGrades.length > 0
          ? Math.round(monthGrades.reduce((s, g) => s + g.grade, 0) / monthGrades.length)
          : 0
      return { month: m.slice(5), avg }
    })

    // 4. Payment collection rate per group (current month)
    const paymentRates: PaymentPoint[] = groupList.map((g) => {
      const gPay = (payments ?? []).filter((p) => p.group_id === g.id && p.month === currentMonth)
      const paid = gPay.filter((p) => p.status === 'paid').length
      const unpaid = gPay.filter((p) => p.status === 'unpaid').length
      return { group: g.name, paid, unpaid }
    })

    // 5. Top 5 students by attendance (present count)
    const studentAttendance: Record<string, number> = {}
    ;(attendance ?? []).forEach((a) => {
      if (a.status === 'present') {
        studentAttendance[a.student_id] = (studentAttendance[a.student_id] ?? 0) + 1
      }
    })
    const studentMap: Record<string, string> = {}
    ;(students ?? []).forEach((s) => { studentMap[s.id] = s.full_name })
    const topByAttendance: TopStudent[] = Object.entries(studentAttendance)
      .map(([id, value]) => ({ name: studentMap[id] ?? id, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    // 6. Top 5 students by average grade
    const studentGrades: Record<string, number[]> = {}
    ;(grades ?? []).forEach((g) => {
      if (!studentGrades[g.student_id]) studentGrades[g.student_id] = []
      studentGrades[g.student_id].push(g.grade)
    })
    const topByGrades: TopStudent[] = Object.entries(studentGrades)
      .map(([id, gs]) => ({
        name: studentMap[id] ?? id,
        value: Math.round(gs.reduce((s, g) => s + g, 0) / gs.length),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    // At-risk students: 3+ absences this month
    const absentCount: Record<string, number> = {}
    ;(attendance ?? [])
      .filter((a) => a.status === 'absent' && a.date.startsWith(currentMonthPrefix))
      .forEach((a) => { absentCount[a.student_id] = (absentCount[a.student_id] ?? 0) + 1 })
    const atRiskStudents = Object.entries(absentCount)
      .filter(([, count]) => count >= 3)
      .map(([id, absences]) => ({ name: studentMap[id] ?? id, absences }))
      .sort((a, b) => b.absences - a.absences)

    setData({
      totalStudents: (students ?? []).length,
      totalGroups: groupList.length,
      monthlyRevenue,
      attendanceRates,
      gradesTrend,
      paymentRates,
      atRiskStudents,
      topByAttendance,
      topByGrades,
    })
    setLoading(false)
  }

  async function fetchAiInsight() {
    if (!data) return
    setAiLoading(true)
    setAiInsight('')

    const prompt = `Siz ta'lim markazining AI tahlilchisisiz. Quyidagi ma'lumotlar asosida o'zbek tilida qisqa va aniq tavsiyalar bering:

O'quvchilar soni: ${data.totalStudents}
Guruhlar soni: ${data.totalGroups}
So'nggi 6 oy daromad (so'm): ${data.monthlyRevenue.map((m) => `${m.month}: ${m.revenue.toLocaleString()}`).join(', ')}
Guruhlar bo'yicha davomat foizi (joriy oy): ${data.attendanceRates.map((a) => `${a.group}: ${a.rate}%`).join(', ')}
Oylik o'rtacha baholar: ${data.gradesTrend.map((g) => `${g.month}: ${g.avg}`).join(', ')}
Xavf ostidagi o'quvchilar (3+ yo'qlik): ${data.atRiskStudents.map((s) => `${s.name} (${s.absences} yo'qlik)`).join(', ') || 'Yo\'q'}

Quyidagilarni tahlil qiling:
1. Daromad prognozi (keyingi oy uchun)
2. Xavf ostidagi o'quvchilar haqida tavsiya
3. Davomat bo'yicha muammoli guruhlar
4. O'quvchilar ko'rsatkichlarini yaxshilash bo'yicha 3 ta amaliy tavsiya`

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY as string,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const json = await response.json()
      const text = json.content?.[0]?.text ?? 'Tahlil olishda xatolik yuz berdi.'
      setAiInsight(text)
    } catch (err) {
      console.error('[AI] error:', err)
      setAiInsight('Tahlil olishda xatolik yuz berdi.')
    }
    setAiLoading(false)
  }

  if (loading) return <p className="text-gray-400">Yuklanmoqda...</p>
  if (!data) return null

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Tahlil</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="O'quvchilar" value={data.totalStudents} />
        <StatCard label="Guruhlar" value={data.totalGroups} />
        <StatCard
          label="Joriy oy daromad"
          value={`${data.monthlyRevenue[data.monthlyRevenue.length - 1]?.revenue.toLocaleString()} so'm`}
        />
        <StatCard label="Xavf ostida" value={data.atRiskStudents.length} color="text-red-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly revenue */}
        <ChartCard title="Oylik daromad (so'm)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v) => typeof v === 'number' ? v.toLocaleString() : v} />
              <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Attendance rate per group */}
        <ChartCard title="Davomat foizi (joriy oy, %)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.attendanceRates}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="group" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="rate" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Average grades trend */}
        <ChartCard title="O'rtacha baho trendi">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.gradesTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="avg" stroke="#d97706" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Payment collection rate */}
        <ChartCard title="To'lov holati (joriy oy)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.paymentRates}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="group" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="paid" name="To'ladi" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="unpaid" name="To'lamadi" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top students tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <TopTable title="Top 5 — Davomat bo'yicha" rows={data.topByAttendance} unit="kun" />
        <TopTable title="Top 5 — Baho bo'yicha" rows={data.topByGrades} unit="ball" />
      </div>

      {/* At-risk students */}
      {data.atRiskStudents.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <h2 className="text-sm font-semibold text-red-700 mb-3">
            Xavf ostidagi o'quvchilar (3+ yo'qlik, joriy oy)
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.atRiskStudents.map((s) => (
              <span key={s.name} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full">
                {s.name} — {s.absences} yo'qlik
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">AI Tahlil</h2>
          <button
            onClick={fetchAiInsight}
            disabled={aiLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {aiLoading ? 'Tahlil olinmoqda...' : 'AI Tahlil olish'}
          </button>
        </div>
        {aiInsight ? (
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{aiInsight}</div>
        ) : (
          <p className="text-sm text-gray-400">
            "AI Tahlil olish" tugmasini bosing — ma'lumotlaringiz asosida tavsiyalar olinadi.
          </p>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  color = 'text-gray-800',
}: {
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function TopTable({ title, rows, unit }: { title: string; rows: TopStudent[]; unit: string }) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 px-4 py-3">Ma'lumot yo'q.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody className="divide-y">
            {rows.map((r, i) => (
              <tr key={r.name} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-400 w-8">{i + 1}</td>
                <td className="px-4 py-2 text-gray-800 font-medium">{r.name}</td>
                <td className="px-4 py-2 text-right text-blue-600 font-semibold">
                  {r.value} {unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
