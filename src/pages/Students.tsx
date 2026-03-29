import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

interface Student {
  id: string
  full_name: string
  father_name: string | null
  phone: string | null
  telegram_id: string | null
  parent_name: string | null
  parent_phone: string | null
  parent_telegram: string | null
}

interface FormState {
  full_name: string
  father_name: string
  phone: string
  telegram_id: string
  parent_name: string
  parent_phone: string
  parent_telegram: string
}

const emptyForm: FormState = {
  full_name: '',
  father_name: '',
  phone: '',
  telegram_id: '',
  parent_name: '',
  parent_phone: '',
  parent_telegram: '',
}

export default function Students() {
  const { org } = useAuthStore()
  const [students, setStudents] = useState<Student[]>([])
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
    fetchStudents(orgId)
  }, [org?.id])

  async function fetchStudents(orgId: string) {
    setLoading(true)
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name, father_name, phone, telegram_id, parent_name, parent_phone, parent_telegram')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })

    if (error) console.error('[Students] fetch error:', error)
    if (data) setStudents(data)
    setLoading(false)
  }

  function openAdd() {
    setForm(emptyForm)
    setError('')
    setShowAddModal(true)
  }

  function openEdit(student: Student) {
    setForm({
      full_name: student.full_name,
      father_name: student.father_name ?? '',
      phone: student.phone ?? '',
      telegram_id: student.telegram_id ?? '',
      parent_name: student.parent_name ?? '',
      parent_phone: student.parent_phone ?? '',
      parent_telegram: student.parent_telegram ?? '',
    })
    setError('')
    setEditingId(student.id)
  }

  function closeModals() {
    setShowAddModal(false)
    setEditingId(null)
    setDeleteId(null)
    setForm(emptyForm)
    setError('')
  }

  function nullify(val: string) {
    return val.trim() || null
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error } = await supabase.from('students').insert({
      org_id: org?.id,
      full_name: form.full_name.trim(),
      father_name: nullify(form.father_name),
      phone: nullify(form.phone),
      telegram_id: nullify(form.telegram_id),
      parent_name: nullify(form.parent_name),
      parent_phone: nullify(form.parent_phone),
      parent_telegram: nullify(form.parent_telegram),
    })

    if (error) {
      setError(error.message)
    } else {
      if (org?.id) await fetchStudents(org.id)
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
      .from('students')
      .update({
        full_name: form.full_name.trim(),
        father_name: nullify(form.father_name),
        phone: nullify(form.phone),
        telegram_id: nullify(form.telegram_id),
        parent_name: nullify(form.parent_name),
        parent_phone: nullify(form.parent_phone),
        parent_telegram: nullify(form.parent_telegram),
      })
      .eq('id', editingId)

    if (error) {
      setError(error.message)
    } else {
      if (org?.id) await fetchStudents(org.id)
      closeModals()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    setSaving(true)

    const { error } = await supabase.from('students').delete().eq('id', deleteId)

    if (!error) {
      setStudents((prev) => prev.filter((s) => s.id !== deleteId))
      setDeleteId(null)
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">O'quvchilar</h1>
        <button
          onClick={openAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          + Yangi o'quvchi qo'shish
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Yuklanmoqda...</p>
      ) : students.length === 0 ? (
        <p className="text-gray-400">Hali o'quvchilar qo'shilmagan.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">#</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Ism familiya</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Otasining ismi</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Telefon</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Telegram</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {students.map((student, i) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{student.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">{student.father_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{student.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{student.telegram_id ?? '—'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(student)}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Tahrirlash
                    </button>
                    <button
                      onClick={() => setDeleteId(student.id)}
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
        <Modal title="Yangi o'quvchi qo'shish" onClose={closeModals}>
          <form onSubmit={handleAdd} className="space-y-4">
            <StudentFormFields form={form} setForm={setForm} error={error} />
            <ModalActions onCancel={closeModals} saving={saving} label="Qo'shish" />
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editingId && (
        <Modal title="O'quvchini tahrirlash" onClose={closeModals}>
          <form onSubmit={handleEdit} className="space-y-4">
            <StudentFormFields form={form} setForm={setForm} error={error} />
            <ModalActions onCancel={closeModals} saving={saving} label="Saqlash" />
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <Modal title="O'chirishni tasdiqlang" onClose={closeModals}>
          <p className="text-gray-600 text-sm mb-6">
            Bu o'quvchini o'chirishni xohlaysizmi? Bu amalni qaytarib bo'lmaydi.
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

function StudentFormFields({
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

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">O'quvchi ma'lumotlari</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm text-gray-600 mb-1">Ism familiya <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
            placeholder="Ali Valiyev"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm text-gray-600 mb-1">Otasining ismi</label>
          <input
            type="text"
            value={form.father_name}
            onChange={(e) => setForm({ ...form, father_name: e.target.value })}
            placeholder="Vali"
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
          <label className="block text-sm text-gray-600 mb-1">Telegram ID</label>
          <input
            type="text"
            value={form.telegram_id}
            onChange={(e) => setForm({ ...form, telegram_id: e.target.value })}
            placeholder="@username"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-1">Ota-ona ma'lumotlari</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm text-gray-600 mb-1">Ota-ona ismi</label>
          <input
            type="text"
            value={form.parent_name}
            onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
            placeholder="Vali Valiyev"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Telefon</label>
          <input
            type="text"
            value={form.parent_phone}
            onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
            placeholder="+998 90 123 45 67"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Telegram ID</label>
          <input
            type="text"
            value={form.parent_telegram}
            onChange={(e) => setForm({ ...form, parent_telegram: e.target.value })}
            placeholder="@username"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 mx-4">
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
