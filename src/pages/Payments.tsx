import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { sendTelegramMessage } from '../lib/telegram'

interface Group {
  id: string
  name: string
  subjectPrice: number
}

interface Student {
  id: string
  full_name: string
  parent_name: string | null
  parent_telegram: string | null
}

interface PaymentEntry {
  status: 'paid' | 'unpaid'
  amount: number
}

interface HistoryRecord {
  month: string
  paid: number
  unpaid: number
  total: number
  paidAmount: number
}

type Tab = 'take' | 'history'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

export default function Payments() {
  const { org } = useAuthStore()
  const [tab, setTab] = useState<Tab>('take')
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [month, setMonth] = useState(currentMonth())
  const [students, setStudents] = useState<Student[]>([])
  const [paymentMap, setPaymentMap] = useState<Record<string, PaymentEntry>>({})
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [subjectPrice, setSubjectPrice] = useState(0)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const orgId = org?.id
    if (!orgId) return
    fetchGroups(orgId)
  }, [org?.id])

  useEffect(() => {
    if (!selectedGroupId) return
    const group = groups.find((g) => g.id === selectedGroupId)
    setSubjectPrice(group?.subjectPrice ?? 0)
    if (tab === 'take') fetchStudentsAndPayments()
    if (tab === 'history') fetchHistory()
  }, [selectedGroupId, month, tab])

  async function fetchGroups(orgId: string) {
    const { data } = await supabase
      .from('groups')
      .select('id, name, subjects(price)')
      .eq('org_id', orgId)
      .order('name')

    if (data) {
      const mapped: Group[] = (data as unknown as { id: string; name: string; subjects: { price: number } | null }[]).map(
        (g) => ({ id: g.id, name: g.name, subjectPrice: g.subjects?.price ?? 0 })
      )
      setGroups(mapped)
      if (mapped.length > 0) setSelectedGroupId(mapped[0].id)
    }
  }

  async function fetchStudentsAndPayments() {
    setLoadingStudents(true)
    setSaved(false)

    const { data: gsData } = await supabase
      .from('group_students')
      .select('students(id, full_name, parent_name, parent_telegram)')
      .eq('group_id', selectedGroupId)

    const studentList: Student[] = (gsData ?? [])
      .map((row: unknown) => (row as { students: Student | null }).students)
      .filter((s): s is Student => s !== null)
      .sort((a, b) => a.full_name.localeCompare(b.full_name))

    setStudents(studentList)

    const { data: payData } = await supabase
      .from('payments')
      .select('student_id, status, amount')
      .eq('group_id', selectedGroupId)
      .eq('month', month)

    const group = groups.find((g) => g.id === selectedGroupId)
    const defaultAmount = group?.subjectPrice ?? 0

    const map: Record<string, PaymentEntry> = {}
    studentList.forEach((s) => {
      map[s.id] = { status: 'unpaid', amount: defaultAmount }
    })
    ;(payData ?? []).forEach((p) => {
      map[p.student_id] = { status: p.status as 'paid' | 'unpaid', amount: p.amount }
    })

    setPaymentMap(map)
    setLoadingStudents(false)
  }

  async function fetchHistory() {
    setLoadingHistory(true)

    const { data } = await supabase
      .from('payments')
      .select('month, status, amount')
      .eq('group_id', selectedGroupId)
      .order('month', { ascending: false })

    if (data) {
      const byMonth: Record<string, { paid: number; unpaid: number; paidAmount: number }> = {}
      data.forEach((r) => {
        if (!byMonth[r.month]) byMonth[r.month] = { paid: 0, unpaid: 0, paidAmount: 0 }
        if (r.status === 'paid') {
          byMonth[r.month].paid++
          byMonth[r.month].paidAmount += r.amount
        } else {
          byMonth[r.month].unpaid++
        }
      })

      setHistory(
        Object.entries(byMonth).map(([month, c]) => ({
          month,
          paid: c.paid,
          unpaid: c.unpaid,
          total: c.paid + c.unpaid,
          paidAmount: c.paidAmount,
        }))
      )
    }
    setLoadingHistory(false)
  }

  function toggleStatus(studentId: string) {
    setPaymentMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status: prev[studentId]?.status === 'paid' ? 'unpaid' : 'paid',
      },
    }))
    setSaved(false)
  }

  function setAmount(studentId: string, amount: number) {
    setPaymentMap((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], amount },
    }))
    setSaved(false)
  }

  async function handleSave() {
    if (!selectedGroupId || students.length === 0) return
    setSaving(true)

    const records = students.map((s) => ({
      org_id: org?.id,
      group_id: selectedGroupId,
      student_id: s.id,
      month,
      status: paymentMap[s.id]?.status ?? 'unpaid',
      amount: paymentMap[s.id]?.amount ?? subjectPrice,
    }))

    const { error } = await supabase
      .from('payments')
      .upsert(records, { onConflict: 'student_id,group_id,month' })

    if (!error) {
      setSaved(true)
      for (const s of students) {
        const entry = paymentMap[s.id]
        if (entry?.status !== 'paid' || !s.parent_telegram) continue
        const parentName = s.parent_name ?? 'Ota-ona'
        const msg = `Hurmatli ${parentName}, ${s.full_name} ning ${month} oylik to'lovi qabul qilindi. Summa: ${entry.amount.toLocaleString()} so'm`
        sendTelegramMessage(s.parent_telegram, msg)
      }
    }
    setSaving(false)
  }

  const paidCount = Object.values(paymentMap).filter((p) => p.status === 'paid').length
  const unpaidCount = Object.values(paymentMap).filter((p) => p.status === 'unpaid').length
  const totalPaid = Object.values(paymentMap)
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">To'lovlar</h1>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Guruh tanlang —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>

        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        <button
          onClick={() => setTab('take')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'take'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          To'lov holati
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'history'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Tarix
        </button>
      </div>

      {!selectedGroupId ? (
        <p className="text-gray-400">Guruh tanlang.</p>
      ) : tab === 'take' ? (
        <PaymentList
          students={students}
          paymentMap={paymentMap}
          loading={loadingStudents}
          saving={saving}
          saved={saved}
          paidCount={paidCount}
          unpaidCount={unpaidCount}
          totalPaid={totalPaid}
          onToggle={toggleStatus}
          onAmountChange={setAmount}
          onSave={handleSave}
        />
      ) : (
        <PaymentHistory history={history} loading={loadingHistory} />
      )}
    </div>
  )
}

function PaymentList({
  students,
  paymentMap,
  loading,
  saving,
  saved,
  paidCount,
  unpaidCount,
  totalPaid,
  onToggle,
  onAmountChange,
  onSave,
}: {
  students: Student[]
  paymentMap: Record<string, PaymentEntry>
  loading: boolean
  saving: boolean
  saved: boolean
  paidCount: number
  unpaidCount: number
  totalPaid: number
  onToggle: (id: string) => void
  onAmountChange: (id: string, amount: number) => void
  onSave: () => void
}) {
  if (loading) return <p className="text-gray-400">Yuklanmoqda...</p>
  if (students.length === 0) return <p className="text-gray-400">Bu guruhda o'quvchi yo'q.</p>

  return (
    <div>
      {/* Summary */}
      <div className="flex gap-4 mb-4">
        <span className="text-sm text-green-600 font-medium">To'ladi: {paidCount}</span>
        <span className="text-sm text-red-500 font-medium">To'lamadi: {unpaidCount}</span>
        <span className="text-sm text-gray-500 font-medium">
          Jami: {totalPaid.toLocaleString()} so'm
        </span>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">#</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Ism familiya</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Miqdor (so'm)</th>
              <th className="text-center px-4 py-3 text-gray-600 font-medium">Holat</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {students.map((student, i) => {
              const entry = paymentMap[student.id] ?? { status: 'unpaid', amount: 0 }
              return (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{student.full_name}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      value={entry.amount}
                      onChange={(e) => onAmountChange(student.id, parseInt(e.target.value) || 0)}
                      className="w-32 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onToggle(student.id)}
                      className={`px-4 py-1 rounded-full text-xs font-semibold transition-colors ${
                        entry.status === 'paid'
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-red-100 text-red-600 hover:bg-red-200'
                      }`}
                    >
                      {entry.status === 'paid' ? "To'ladi" : "To'lamadi"}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
        {saved && <span className="text-green-600 text-sm">✓ Saqlandi</span>}
      </div>
    </div>
  )
}

function PaymentHistory({
  history,
  loading,
}: {
  history: HistoryRecord[]
  loading: boolean
}) {
  if (loading) return <p className="text-gray-400">Yuklanmoqda...</p>
  if (history.length === 0) return <p className="text-gray-400">To'lov tarixi yo'q.</p>

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[480px]">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 text-gray-600 font-medium">Oy</th>
            <th className="text-center px-4 py-3 text-gray-600 font-medium">To'ladi</th>
            <th className="text-center px-4 py-3 text-gray-600 font-medium">To'lamadi</th>
            <th className="text-center px-4 py-3 text-gray-600 font-medium">Jami</th>
            <th className="text-right px-4 py-3 text-gray-600 font-medium">Tushum</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {history.map((row) => (
            <tr key={row.month} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-800 font-medium">{row.month}</td>
              <td className="px-4 py-3 text-center text-green-600 font-medium">{row.paid}</td>
              <td className="px-4 py-3 text-center text-red-500 font-medium">{row.unpaid}</td>
              <td className="px-4 py-3 text-center text-gray-500">{row.total}</td>
              <td className="px-4 py-3 text-right text-gray-800 font-medium">
                {row.paidAmount.toLocaleString()} so'm
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
