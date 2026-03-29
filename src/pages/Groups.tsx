import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

interface Group {
  id: string
  name: string
  schedule: string | null
  subject_id: string | null
  teacher_id: string | null
  subjects: { name: string } | null
  teachers: { full_name: string } | null
}

interface SelectOption {
  id: string
  label: string
}

interface FormState {
  name: string
  subject_id: string
  teacher_id: string
  schedule: string
}

const emptyForm: FormState = { name: '', subject_id: '', teacher_id: '', schedule: '' }

export default function Groups() {
  const { org } = useAuthStore()
  const navigate = useNavigate()
  const [groups, setGroups] = useState<Group[]>([])
  const [subjects, setSubjects] = useState<SelectOption[]>([])
  const [teachers, setTeachers] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const orgId = org?.id
    if (!orgId) return
    fetchGroups(orgId)
    fetchSubjects(orgId)
    fetchTeachers(orgId)
  }, [org?.id])

  async function fetchGroups(orgId: string) {
    setLoading(true)
    const { data, error } = await supabase
      .from('groups')
      .select('id, name, schedule, subject_id, teacher_id, subjects(name), teachers(full_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })

    if (error) console.error('[Groups] fetch error:', error)
    if (data) setGroups(data as unknown as Group[])
    setLoading(false)
  }

  async function fetchSubjects(orgId: string) {
    const { data } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('org_id', orgId)
      .order('name')
    if (data) setSubjects(data.map((s) => ({ id: s.id, label: s.name })))
  }

  async function fetchTeachers(orgId: string) {
    const { data } = await supabase
      .from('teachers')
      .select('id, full_name')
      .eq('org_id', orgId)
      .order('full_name')
    if (data) setTeachers(data.map((t) => ({ id: t.id, label: t.full_name })))
  }

  function openAdd() {
    setForm(emptyForm)
    setError('')
    setShowAddModal(true)
  }

  function openEdit(group: Group) {
    setForm({
      name: group.name,
      subject_id: group.subject_id ?? '',
      teacher_id: group.teacher_id ?? '',
      schedule: group.schedule ?? '',
    })
    setError('')
    setEditingId(group.id)
  }

  function closeModals() {
    setShowAddModal(false)
    setEditingId(null)
    setDeleteId(null)
    setForm(emptyForm)
    setError('')
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error } = await supabase.from('groups').insert({
      org_id: org?.id,
      name: form.name.trim(),
      subject_id: form.subject_id || null,
      teacher_id: form.teacher_id || null,
      schedule: form.schedule.trim() || null,
    })

    if (error) {
      setError(error.message)
    } else {
      if (org?.id) await fetchGroups(org.id)
      closeModals()
    }
    setSaving(false)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setSaving(true)
    setError('')

    const { error } = await supabase
      .from('groups')
      .update({
        name: form.name.trim(),
        subject_id: form.subject_id || null,
        teacher_id: form.teacher_id || null,
        schedule: form.schedule.trim() || null,
      })
      .eq('id', editingId)

    if (error) {
      setError(error.message)
    } else {
      if (org?.id) await fetchGroups(org.id)
      closeModals()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    setSaving(true)

    const { error } = await supabase.from('groups').delete().eq('id', deleteId)

    if (!error) {
      setGroups((prev) => prev.filter((g) => g.id !== deleteId))
      setDeleteId(null)
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Guruhlar</h1>
        <button
          onClick={openAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          + Yangi guruh qo'shish
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Yuklanmoqda...</p>
      ) : groups.length === 0 ? (
        <p className="text-gray-400">Hali guruhlar qo'shilmagan.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">#</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Guruh nomi</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Fan</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">O'qituvchi</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Jadval</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {groups.map((group, i) => (
                <tr key={group.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/groups/${group.id}`)}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {group.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{group.subjects?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{group.teachers?.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{group.schedule ?? '—'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(group)}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Tahrirlash
                    </button>
                    <button
                      onClick={() => setDeleteId(group.id)}
                      className="text-red-500 hover:underline text-xs"
                    >
                      O'chirish
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <Modal title="Yangi guruh qo'shish" onClose={closeModals}>
          <form onSubmit={handleAdd} className="space-y-4">
            <GroupFormFields
              form={form}
              setForm={setForm}
              subjects={subjects}
              teachers={teachers}
              error={error}
            />
            <ModalActions onCancel={closeModals} saving={saving} label="Qo'shish" />
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editingId && (
        <Modal title="Guruhni tahrirlash" onClose={closeModals}>
          <form onSubmit={handleEdit} className="space-y-4">
            <GroupFormFields
              form={form}
              setForm={setForm}
              subjects={subjects}
              teachers={teachers}
              error={error}
            />
            <ModalActions onCancel={closeModals} saving={saving} label="Saqlash" />
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <Modal title="O'chirishni tasdiqlang" onClose={closeModals}>
          <p className="text-gray-600 text-sm mb-6">
            Bu guruhni o'chirishni xohlaysizmi? Bu amalni qaytarib bo'lmaydi.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={closeModals}
              className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
            >
              Bekor qilish
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              {saving ? "O'chirilmoqda..." : "O'chirish"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function GroupFormFields({
  form,
  setForm,
  subjects,
  teachers,
  error,
}: {
  form: FormState
  setForm: (f: FormState) => void
  subjects: SelectOption[]
  teachers: SelectOption[]
  error: string
}) {
  return (
    <>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div>
        <label className="block text-sm text-gray-600 mb-1">Guruh nomi</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          placeholder="Masalan: Matematika A1"
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Fan</label>
        <select
          value={form.subject_id}
          onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Tanlang —</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">O'qituvchi</label>
        <select
          value={form.teacher_id}
          onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Tanlang —</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Dars jadvali</label>
        <input
          type="text"
          value={form.schedule}
          onChange={(e) => setForm({ ...form, schedule: e.target.value })}
          placeholder="Masalan: Du, Cho, Ju | 14:00–16:00"
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalActions({
  onCancel,
  saving,
  label,
}: {
  onCancel: () => void
  saving: boolean
  label: string
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
      >
        Bekor qilish
      </button>
      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saqlanmoqda...' : label}
      </button>
    </div>
  )
}
