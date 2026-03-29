import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { sendTelegramMessage } from '../lib/telegram'

interface Group {
  id: string
  name: string
  subjectName: string | null
}

interface Student {
  id: string
  full_name: string
  parent_name: string | null
  parent_telegram: string | null
}

interface GradeEntry {
  grade: string
  comment: string
}

interface HistoryRecord {
  date: string
  avg: number
  count: number
}

type Tab = 'take' | 'history'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function Grades() {
  const { org } = useAuthStore()
  const [tab, setTab] = useState<Tab>('take')
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [date, setDate] = useState(today())
  const [students, setStudents] = useState<Student[]>([])
  const [gradeMap, setGradeMap] = useState<Record<string, GradeEntry>>({})
  const [history, setHistory] = useState<HistoryRecord[]>([])
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
    if (tab === 'take') fetchStudentsAndGrades()
    if (tab === 'history') fetchHistory()
  }, [selectedGroupId, date, tab])

  async function fetchGroups(orgId: string) {
    const { data } = await supabase
      .from('groups')
      .select('id, name, subjects(name)')
      .eq('org_id', orgId)
      .order('name')
    if (data) {
      const mapped: Group[] = (data as unknown as { id: string; name: string; subjects: { name: string } | null }[]).map(
        (g) => ({ id: g.id, name: g.name, subjectName: g.subjects?.name ?? null })
      )
      setGroups(mapped)
      if (mapped.length > 0) setSelectedGroupId(mapped[0].id)
    }
  }

  async function fetchStudentsAndGrades() {
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

    const { data: gradeData } = await supabase
      .from('grades')
      .select('student_id, grade, comment')
      .eq('group_id', selectedGroupId)
      .eq('date', date)

    const map: Record<string, GradeEntry> = {}
    studentList.forEach((s) => { map[s.id] = { grade: '', comment: '' } })
    ;(gradeData ?? []).forEach((r) => {
      map[r.student_id] = {
        grade: String(r.grade),
        comment: r.comment ?? '',
      }
    })

    setGradeMap(map)
    setLoadingStudents(false)
  }

  async function fetchHistory() {
    setLoadingHistory(true)

    const { data } = await supabase
      .from('grades')
      .select('date, grade')
      .eq('group_id', selectedGroupId)
      .order('date', { ascending: false })

    if (data) {
      const byDate: Record<string, number[]> = {}
      data.forEach((r) => {
        if (!byDate[r.date]) byDate[r.date] = []
        byDate[r.date].push(r.grade)
      })

      setHistory(
        Object.entries(byDate).map(([date, grades]) => ({
          date,
          count: grades.length,
          avg: Math.round(grades.reduce((s, g) => s + g, 0) / grades.length),
        }))
      )
    }
    setLoadingHistory(false)
  }

  function setGrade(studentId: string, value: string) {
    const num = parseInt(value)
    if (value !== '' && (isNaN(num) || num < 0 || num > 100)) return
    setGradeMap((prev) => ({ ...prev, [studentId]: { ...prev[studentId], grade: value } }))
    setSaved(false)
  }

  function setComment(studentId: string, value: string) {
    setGradeMap((prev) => ({ ...prev, [studentId]: { ...prev[studentId], comment: value } }))
    setSaved(false)
  }

  async function handleSave() {
    if (!selectedGroupId || students.length === 0) return

    const records = students
      .filter((s) => gradeMap[s.id]?.grade !== '')
      .map((s) => ({
        org_id: org?.id,
        group_id: selectedGroupId,
        student_id: s.id,
        date,
        grade: parseInt(gradeMap[s.id].grade),
        comment: gradeMap[s.id].comment.trim() || null,
      }))

    if (records.length === 0) return
    setSaving(true)

    const { error } = await supabase
      .from('grades')
      .upsert(records, { onConflict: 'student_id,group_id,date' })

    if (!error) {
      setSaved(true)
      const group = groups.find((g) => g.id === selectedGroupId)
      const subjectName = group?.subjectName ?? ''
      for (const s of students) {
        const entry = gradeMap[s.id]
        if (!entry?.grade || !s.parent_telegram) continue
        const parentName = s.parent_name ?? 'Ota-ona'
        const msg = `Hurmatli ${parentName}, ${s.full_name} ning bahosi: ${entry.grade}/100. ${subjectName} ${date}`
        sendTelegramMessage(s.parent_telegram, msg)
      }
    }
    setSaving(false)
  }

  const gradedCount = Object.values(gradeMap).filter((e) => e.grade !== '').length
  const gradeValues = Object.values(gradeMap)
    .map((e) => parseInt(e.grade))
    .filter((n) => !isNaN(n))
  const avg = gradeValues.length > 0
    ? Math.round(gradeValues.reduce((s, g) => s + g, 0) / gradeValues.length)
    : null

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Baholar</h1>

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
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setSaved(false) }}
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
          Baho qo'yish
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

      {/* Grade range legend */}
      <div className="flex flex-wrap gap-3 mb-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          ≥86 — A'lo (Excellent)
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          ≥71 — Yaxshi (Good)
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
          ≥56 — Qoniqarli (Satisfactory)
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          &lt;56 — Qoniqarsiz (Poor)
        </span>
      </div>

      {!selectedGroupId ? (
        <p className="text-gray-400">Guruh tanlang.</p>
      ) : tab === 'take' ? (
        <GradeList
          students={students}
          gradeMap={gradeMap}
          loading={loadingStudents}
          saving={saving}
          saved={saved}
          gradedCount={gradedCount}
          total={students.length}
          avg={avg}
          onGradeChange={setGrade}
          onCommentChange={setComment}
          onSave={handleSave}
        />
      ) : (
        <GradeHistory history={history} loading={loadingHistory} />
      )}
    </div>
  )
}

function GradeList({
  students,
  gradeMap,
  loading,
  saving,
  saved,
  gradedCount,
  total,
  avg,
  onGradeChange,
  onCommentChange,
  onSave,
}: {
  students: Student[]
  gradeMap: Record<string, GradeEntry>
  loading: boolean
  saving: boolean
  saved: boolean
  gradedCount: number
  total: number
  avg: number | null
  onGradeChange: (id: string, value: string) => void
  onCommentChange: (id: string, value: string) => void
  onSave: () => void
}) {
  if (loading) return <p className="text-gray-400">Yuklanmoqda...</p>
  if (students.length === 0) return <p className="text-gray-400">Bu guruhda o'quvchi yo'q.</p>

  return (
    <div>
      {/* Summary */}
      <div className="flex gap-4 mb-4">
        <span className="text-sm text-gray-600 font-medium">Baholandi: {gradedCount}/{total}</span>
        {avg !== null && (
          <span className="text-sm text-blue-600 font-medium">O'rtacha: {avg}</span>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">#</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Ism familiya</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Baho (0–100)</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Izoh</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {students.map((student, i) => {
              const entry = gradeMap[student.id] ?? { grade: '', comment: '' }
              const gradeNum = parseInt(entry.grade)
              const color =
                entry.grade === ''
                  ? 'text-gray-300'
                  : gradeNum >= 86
                  ? 'text-green-600'
                  : gradeNum >= 71
                  ? 'text-blue-600'
                  : gradeNum >= 56
                  ? 'text-yellow-600'
                  : 'text-red-500'

              return (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{student.full_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={entry.grade}
                        onChange={(e) => onGradeChange(student.id, e.target.value)}
                        placeholder="—"
                        className={`w-20 border rounded px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 ${color}`}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={entry.comment}
                      onChange={(e) => onCommentChange(student.id, e.target.value)}
                      placeholder="Ixtiyoriy..."
                      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
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
          disabled={saving || gradedCount === 0}
          className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
        {saved && <span className="text-green-600 text-sm">✓ Saqlandi</span>}
      </div>
    </div>
  )
}

function GradeHistory({
  history,
  loading,
}: {
  history: HistoryRecord[]
  loading: boolean
}) {
  if (loading) return <p className="text-gray-400">Yuklanmoqda...</p>
  if (history.length === 0) return <p className="text-gray-400">Baholar tarixi yo'q.</p>

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[360px]">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 text-gray-600 font-medium">Sana</th>
            <th className="text-center px-4 py-3 text-gray-600 font-medium">O'quvchilar</th>
            <th className="text-center px-4 py-3 text-gray-600 font-medium">O'rtacha baho</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {history.map((row) => (
            <tr key={row.date} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-800 font-medium">{row.date}</td>
              <td className="px-4 py-3 text-center text-gray-600">{row.count}</td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`font-semibold ${
                    row.avg >= 86
                      ? 'text-green-600'
                      : row.avg >= 71
                      ? 'text-blue-600'
                      : row.avg >= 56
                      ? 'text-yellow-600'
                      : 'text-red-500'
                  }`}
                >
                  {row.avg}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
