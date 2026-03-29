import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

interface GroupInfo {
  id: string
  name: string
  schedule: string | null
  subjects: { name: string } | null
  teachers: { full_name: string } | null
}

interface Student {
  id: string
  full_name: string
  phone: string | null
}

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { org } = useAuthStore()

  const [group, setGroup] = useState<GroupInfo | null>(null)
  const [enrolled, setEnrolled] = useState<Student[]>([])
  const [available, setAvailable] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)

  useEffect(() => {
    if (id && org?.id) fetchAll()
  }, [id, org?.id])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchGroup(), fetchEnrolled()])
    setLoading(false)
  }

  async function fetchGroup() {
    const { data } = await supabase
      .from('groups')
      .select('id, name, schedule, subjects(name), teachers(full_name)')
      .eq('id', id!)
      .single()
    if (data) setGroup(data as unknown as GroupInfo)
  }

  async function fetchEnrolled() {
    const { data: enrolledData } = await supabase
      .from('group_students')
      .select('students(id, full_name, phone)')
      .eq('group_id', id!)

    const students: Student[] = (enrolledData ?? [])
      .map((row: unknown) => (row as { students: Student | null }).students)
      .filter((s): s is Student => s !== null)

    setEnrolled(students)

    // Fetch all org students to compute available (not yet in group)
    const { data: allData } = await supabase
      .from('students')
      .select('id, full_name, phone')
      .eq('org_id', org!.id)
      .order('full_name')

    const enrolledIds = new Set(students.map((s) => s.id))
    setAvailable((allData ?? []).filter((s) => !enrolledIds.has(s.id)))
  }

  async function handleAddStudent() {
    if (!selectedStudentId) return
    setSaving(true)

    const { error } = await supabase
      .from('group_students')
      .insert({ group_id: id!, student_id: selectedStudentId })

    if (!error) {
      setSelectedStudentId('')
      await fetchEnrolled()
    }
    setSaving(false)
  }

  async function handleRemove() {
    if (!removeId) return
    setSaving(true)

    const { error } = await supabase
      .from('group_students')
      .delete()
      .eq('group_id', id!)
      .eq('student_id', removeId)

    if (!error) {
      setEnrolled((prev) => prev.filter((s) => s.id !== removeId))
      setAvailable((prev) => {
        const removed = enrolled.find((s) => s.id === removeId)
        return removed ? [...prev, removed].sort((a, b) => a.full_name.localeCompare(b.full_name)) : prev
      })
      setRemoveId(null)
    }
    setSaving(false)
  }

  if (loading) return <p className="text-gray-400">Yuklanmoqda...</p>
  if (!group) return <p className="text-gray-500">Guruh topilmadi.</p>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/groups')}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Guruhlar
        </button>
        <h1 className="text-2xl font-bold text-gray-800">{group.name}</h1>
      </div>

      {/* Group info */}
      <div className="bg-white rounded-lg shadow p-5 mb-6 flex flex-wrap gap-4 sm:gap-8 text-sm">
        <div>
          <span className="text-gray-400">Fan:</span>{' '}
          <span className="font-medium">{group.subjects?.name ?? '—'}</span>
        </div>
        <div>
          <span className="text-gray-400">O'qituvchi:</span>{' '}
          <span className="font-medium">{group.teachers?.full_name ?? '—'}</span>
        </div>
        <div>
          <span className="text-gray-400">Jadval:</span>{' '}
          <span className="font-medium">{group.schedule ?? '—'}</span>
        </div>
      </div>

      {/* Add student */}
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-700 mb-3">O'quvchi qo'shish</h2>
        {available.length === 0 ? (
          <p className="text-gray-400 text-sm">Qo'shish uchun mavjud o'quvchi yo'q.</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— O'quvchi tanlang —</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}{s.phone ? ` (${s.phone})` : ''}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddStudent}
              disabled={!selectedStudentId || saving}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Qo'shish
            </button>
          </div>
        )}
      </div>

      {/* Enrolled students */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-700">
            Guruhdagi o'quvchilar ({enrolled.length})
          </h2>
        </div>
        {enrolled.length === 0 ? (
          <p className="text-gray-400 text-sm p-5">Guruhda hali o'quvchi yo'q.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">#</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Ism familiya</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Telefon</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {enrolled.map((student, i) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{student.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">{student.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setRemoveId(student.id)}
                      className="text-red-500 hover:underline text-xs"
                    >
                      Chiqarish
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Remove confirmation */}
      {removeId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Guruhdan chiqarish</h2>
            <p className="text-gray-600 text-sm mb-6">
              Bu o'quvchini guruhdan chiqarishni xohlaysizmi?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRemoveId(null)}
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleRemove}
                disabled={saving}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
              >
                {saving ? 'Chiqarilmoqda...' : 'Chiqarish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
