import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { sendTelegramMessage } from '../../lib/telegram'

interface Group { id: string; name: string }
interface Student { id: string; full_name: string; parent_name: string | null; parent_telegram: string | null }
interface HistoryRecord { date: string; present: number; absent: number; total: number }

type Tab = 'take' | 'history'
type Status = 'present' | 'absent'

function today() { return new Date().toISOString().slice(0, 10) }

export default function TeacherAttendance() {
  const { user, org } = useAuthStore()
  const [tab, setTab] = useState<Tab>('take')
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [date, setDate] = useState(today())
  const [students, setStudents] = useState<Student[]>([])
  const [statusMap, setStatusMap] = useState<Record<string, Status>>({})
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (user?.email && org?.id) fetchGroups()
  }, [user?.email, org?.id])

  useEffect(() => {
    if (!selectedGroupId) return
    if (tab === 'take') fetchStudentsAndAttendance()
    if (tab === 'history') fetchHistory()
  }, [selectedGroupId, date, tab])

  async function fetchGroups() {
    setLoadingGroups(true)
    const { data: teacherRecord } = await supabase
      .from('teachers')
      .select('id')
      .eq('email', user!.email!)
      .eq('org_id', org!.id)
      .single()

    if (!teacherRecord) { setLoadingGroups(false); return }

    const { data } = await supabase
      .from('groups')
      .select('id, name')
      .eq('teacher_id', teacherRecord.id)
      .order('name')

    if (data) {
      setGroups(data)
      if (data.length > 0) setSelectedGroupId(data[0].id)
    }
    setLoadingGroups(false)
  }

  async function fetchStudentsAndAttendance() {
    setLoadingStudents(true); setSaved(false)

    const { data: gsData } = await supabase
      .from('group_students')
      .select('students(id, full_name, parent_name, parent_telegram)')
      .eq('group_id', selectedGroupId)

    const studentList: Student[] = (gsData ?? [])
      .map((row: unknown) => (row as { students: Student | null }).students)
      .filter((s): s is Student => s !== null)
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
    setStudents(studentList)

    const { data: attData } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('group_id', selectedGroupId)
      .eq('date', date)

    const map: Record<string, Status> = {}
    studentList.forEach((s) => { map[s.id] = 'present' })
    ;(attData ?? []).forEach((r) => { map[r.student_id] = r.status as Status })
    setStatusMap(map)
    setLoadingStudents(false)
  }

  async function fetchHistory() {
    setLoadingHistory(true)
    const { data } = await supabase
      .from('attendance')
      .select('date, status')
      .eq('group_id', selectedGroupId)
      .order('date', { ascending: false })

    if (data) {
      const byDate: Record<string, { present: number; absent: number }> = {}
      data.forEach((r) => {
        if (!byDate[r.date]) byDate[r.date] = { present: 0, absent: 0 }
        if (r.status === 'present') byDate[r.date].present++
        else byDate[r.date].absent++
      })
      setHistory(Object.entries(byDate).map(([d, c]) => ({ date: d, present: c.present, absent: c.absent, total: c.present + c.absent })))
    }
    setLoadingHistory(false)
  }

  function toggleStatus(studentId: string) {
    setStatusMap((prev) => ({ ...prev, [studentId]: prev[studentId] === 'present' ? 'absent' : 'present' }))
    setSaved(false)
  }

  async function handleSave() {
    if (!selectedGroupId || students.length === 0) return
    setSaving(true)
    const records = students.map((s) => ({
      org_id: org?.id,
      group_id: selectedGroupId,
      student_id: s.id,
      date,
      status: statusMap[s.id] ?? 'present',
    }))
    const { error } = await supabase.from('attendance').upsert(records, { onConflict: 'group_id,student_id,date' })
    if (!error) {
      setSaved(true)
      for (const s of students) {
        if (!s.parent_telegram) continue
        const parentName = s.parent_name ?? 'Ota-ona'
        const status = statusMap[s.id] ?? 'present'
        const msg = status === 'absent'
          ? `Hurmatli ${parentName}, ${s.full_name} bugun darsga kelmadi. ${date}`
          : `Hurmatli ${parentName}, ${s.full_name} bugun darsga keldi. ${date}`
        sendTelegramMessage(s.parent_telegram, msg)
      }
    }
    setSaving(false)
  }

  const presentCount = Object.values(statusMap).filter((s) => s === 'present').length
  const absentCount = Object.values(statusMap).filter((s) => s === 'absent').length

  if (loadingGroups) return <p className="text-gray-400">Yuklanmoqda...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Davomat</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">— Guruh tanlang —</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="flex gap-1 mb-6 border-b">
        {(['take', 'history'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'take' ? 'Davomat olish' : 'Tarix'}
          </button>
        ))}
      </div>

      {!selectedGroupId ? (
        <p className="text-gray-400">Guruh tanlang.</p>
      ) : tab === 'take' ? (
        loadingStudents ? <p className="text-gray-400">Yuklanmoqda...</p> :
        students.length === 0 ? <p className="text-gray-400">Bu guruhda o'quvchi yo'q.</p> : (
          <div>
            <div className="flex gap-4 mb-4">
              <span className="text-sm text-green-600 font-medium">Keldi: {presentCount}</span>
              <span className="text-sm text-red-500 font-medium">Kelmadi: {absentCount}</span>
              <span className="text-sm text-gray-400">Jami: {students.length}</span>
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[360px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium">#</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium">Ism familiya</th>
                      <th className="text-center px-4 py-3 text-gray-600 font-medium">Holat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {students.map((s, i) => {
                      const status = statusMap[s.id] ?? 'present'
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                          <td className="px-4 py-3 text-gray-800 font-medium">{s.full_name}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => toggleStatus(s.id)} className={`px-4 py-1 rounded-full text-xs font-semibold transition-colors ${status === 'present' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                              {status === 'present' ? 'Keldi' : 'Kelmadi'}
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
              <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
              {saved && <span className="text-green-600 text-sm">✓ Saqlandi</span>}
            </div>
          </div>
        )
      ) : (
        loadingHistory ? <p className="text-gray-400">Yuklanmoqda...</p> :
        history.length === 0 ? <p className="text-gray-400">Davomat tarixi yo'q.</p> : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[360px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Sana</th>
                    <th className="text-center px-4 py-3 text-gray-600 font-medium">Keldi</th>
                    <th className="text-center px-4 py-3 text-gray-600 font-medium">Kelmadi</th>
                    <th className="text-center px-4 py-3 text-gray-600 font-medium">Jami</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {history.map((row) => (
                    <tr key={row.date} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-800 font-medium">{row.date}</td>
                      <td className="px-4 py-3 text-center text-green-600 font-medium">{row.present}</td>
                      <td className="px-4 py-3 text-center text-red-500 font-medium">{row.absent}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
