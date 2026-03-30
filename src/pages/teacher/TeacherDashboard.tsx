import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

interface Group {
  id: string
  name: string
  schedule: string | null
  subjectName: string | null
  studentCount: number
}

export default function TeacherDashboard() {
  const { user, org, fullName } = useAuthStore()
  const navigate = useNavigate()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.email && org?.id) fetchGroups()
  }, [user?.email, org?.id])

  async function fetchGroups() {
    setLoading(true)

    // Find teacher record by email
    const { data: teacherRecord } = await supabase
      .from('teachers')
      .select('id')
      .eq('email', user!.email!)
      .eq('org_id', org!.id)
      .single()

    if (!teacherRecord) { setLoading(false); return }

    const { data: groupData } = await supabase
      .from('groups')
      .select('id, name, schedule, subjects(name)')
      .eq('teacher_id', teacherRecord.id)
      .order('name')

    if (!groupData) { setLoading(false); return }

    // Fetch student counts per group
    const groupIds = groupData.map((g) => g.id)
    const { data: gsData } = await supabase
      .from('group_students')
      .select('group_id')
      .in('group_id', groupIds)

    const countMap: Record<string, number> = {}
    ;(gsData ?? []).forEach((r) => { countMap[r.group_id] = (countMap[r.group_id] ?? 0) + 1 })

    setGroups(
      (groupData as unknown as { id: string; name: string; schedule: string | null; subjects: { name: string } | null }[]).map((g) => ({
        id: g.id,
        name: g.name,
        schedule: g.schedule,
        subjectName: g.subjects?.name ?? null,
        studentCount: countMap[g.id] ?? 0,
      }))
    )
    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">
        Xush kelibsiz, {fullName ?? "O'qituvchi"}!
      </h1>
      <p className="text-sm text-gray-500 mb-6">Sizning guruhlaringiz</p>

      {loading ? (
        <p className="text-gray-400">Yuklanmoqda...</p>
      ) : groups.length === 0 ? (
        <p className="text-gray-400">Sizga hali guruh biriktirilmagan.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div key={group.id} className="bg-white rounded-lg shadow p-5 flex flex-col gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-800">{group.name}</h2>
                {group.subjectName && (
                  <p className="text-sm text-gray-500">{group.subjectName}</p>
                )}
                {group.schedule && (
                  <p className="text-xs text-gray-400 mt-0.5">{group.schedule}</p>
                )}
              </div>
              <p className="text-sm text-gray-600">
                <span className="font-medium">{group.studentCount}</span> o'quvchi
              </p>
              <div className="flex gap-2 mt-auto pt-2 border-t">
                <button
                  onClick={() => navigate('/teacher/attendance')}
                  className="flex-1 text-center text-xs font-medium py-1.5 rounded bg-green-50 text-green-700 hover:bg-green-100"
                >
                  Davomat
                </button>
                <button
                  onClick={() => navigate('/teacher/grades')}
                  className="flex-1 text-center text-xs font-medium py-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                >
                  Baholar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
