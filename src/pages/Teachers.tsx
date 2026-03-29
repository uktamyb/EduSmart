import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

interface Teacher {
  id: string
  full_name: string
  phone: string | null
  email: string | null
}

interface FormState {
  full_name: string
  phone: string
  email: string
}

const emptyForm: FormState = { full_name: '', phone: '', email: '' }

export default function Teachers() {
  const { org } = useAuthStore()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (org?.id) fetchTeachers()
  }, [org?.id])

  async function fetchTeachers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('teachers')
      .select('id, full_name, phone, email')
      .eq('org_id', org!.id)
      .order('created_at', { ascending: true })

    if (!error && data) setTeachers(data)
    setLoading(false)
  }

  function openAdd() {
    setForm(emptyForm)
    setError('')
    setShowAddModal(true)
  }

  function openEdit(teacher: Teacher) {
    setForm({
      full_name: teacher.full_name,
      phone: teacher.phone ?? '',
      email: teacher.email ?? '',
    })
    setError('')
    setEditingId(teacher.id)
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

    const { error } = await supabase.from('teachers').insert({
      org_id: org!.id,
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
    })

    if (error) {
      setError(error.message)
    } else {
      await fetchTeachers()
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
      .from('teachers')
      .update({
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      })
      .eq('id', editingId)

    if (error) {
      setError(error.message)
    } else {
      await fetchTeachers()
      closeModals()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    setSaving(true)

    const { error } = await supabase.from('teachers').delete().eq('id', deleteId)

    if (!error) {
      setTeachers((prev) => prev.filter((t) => t.id !== deleteId))
      setDeleteId(null)
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">O'qituvchilar</h1>
        <button
          onClick={openAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          + Yangi o'qituvchi qo'shish
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Yuklanmoqda...</p>
      ) : teachers.length === 0 ? (
        <p className="text-gray-400">Hali o'qituvchilar qo'shilmagan.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">#</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Ism familiya</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Telefon</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Email</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {teachers.map((teacher, i) => (
                <tr key={teacher.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{teacher.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">{teacher.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{teacher.email ?? '—'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(teacher)}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Tahrirlash
                    </button>
                    <button
                      onClick={() => setDeleteId(teacher.id)}
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
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <Modal title="Yangi o'qituvchi qo'shish" onClose={closeModals}>
          <form onSubmit={handleAdd} className="space-y-4">
            <TeacherFormFields form={form} setForm={setForm} error={error} />
            <ModalActions onCancel={closeModals} saving={saving} label="Qo'shish" />
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editingId && (
        <Modal title="O'qituvchini tahrirlash" onClose={closeModals}>
          <form onSubmit={handleEdit} className="space-y-4">
            <TeacherFormFields form={form} setForm={setForm} error={error} />
            <ModalActions onCancel={closeModals} saving={saving} label="Saqlash" />
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <Modal title="O'chirishni tasdiqlang" onClose={closeModals}>
          <p className="text-gray-600 text-sm mb-6">
            Bu o'qituvchini o'chirishni xohlaysizmi? Bu amalni qaytarib bo'lmaydi.
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
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

function TeacherFormFields({
  form,
  setForm,
  error,
}: {
  form: FormState
  setForm: (f: FormState) => void
  error: string
}) {
  return (
    <>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div>
        <label className="block text-sm text-gray-600 mb-1">Ism familiya</label>
        <input
          type="text"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          required
          placeholder="Masalan: Ali Valiyev"
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Telefon</label>
        <input
          type="text"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="+998 90 123 45 67"
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="ali@example.com"
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </>
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
