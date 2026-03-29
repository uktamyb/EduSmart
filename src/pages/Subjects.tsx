import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

interface Subject {
  id: string
  name: string
  price: number
}

interface FormState {
  name: string
  price: string
}

const emptyForm: FormState = { name: '', price: '' }

export default function Subjects() {
  const { org } = useAuthStore()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (org?.id) fetchSubjects()
  }, [org?.id])

  async function fetchSubjects() {
    setLoading(true)
    const { data, error } = await supabase
      .from('subjects')
      .select('id, name, price')
      .eq('org_id', org!.id)
      .order('created_at', { ascending: true })

    if (!error && data) setSubjects(data)
    setLoading(false)
  }

  function openAdd() {
    setForm(emptyForm)
    setError('')
    setShowAddModal(true)
  }

  function openEdit(subject: Subject) {
    setForm({ name: subject.name, price: String(subject.price) })
    setError('')
    setEditingId(subject.id)
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
    if (!form.name.trim()) return
    setSaving(true)
    setError('')

    const { error } = await supabase.from('subjects').insert({
      org_id: org!.id,
      name: form.name.trim(),
      price: parseInt(form.price) || 0,
    })

    if (error) {
      setError(error.message)
    } else {
      await fetchSubjects()
      closeModals()
    }
    setSaving(false)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !editingId) return
    setSaving(true)
    setError('')

    const { error } = await supabase
      .from('subjects')
      .update({ name: form.name.trim(), price: parseInt(form.price) || 0 })
      .eq('id', editingId)

    if (error) {
      setError(error.message)
    } else {
      await fetchSubjects()
      closeModals()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    setSaving(true)

    const { error } = await supabase.from('subjects').delete().eq('id', deleteId)

    if (!error) {
      setSubjects((prev) => prev.filter((s) => s.id !== deleteId))
      setDeleteId(null)
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Fanlar</h1>
        <button
          onClick={openAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          + Yangi fan qo'shish
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Yuklanmoqda...</p>
      ) : subjects.length === 0 ? (
        <p className="text-gray-400">Hali fanlar qo'shilmagan.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">#</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Fan nomi</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Oylik narxi</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {subjects.map((subject, i) => (
                <tr key={subject.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{subject.name}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {subject.price.toLocaleString()} so'm
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(subject)}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Tahrirlash
                    </button>
                    <button
                      onClick={() => setDeleteId(subject.id)}
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
        <Modal title="Yangi fan qo'shish" onClose={closeModals}>
          <form onSubmit={handleAdd} className="space-y-4">
            <SubjectFormFields form={form} setForm={setForm} error={error} />
            <ModalActions onCancel={closeModals} saving={saving} label="Qo'shish" />
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editingId && (
        <Modal title="Fanni tahrirlash" onClose={closeModals}>
          <form onSubmit={handleEdit} className="space-y-4">
            <SubjectFormFields form={form} setForm={setForm} error={error} />
            <ModalActions onCancel={closeModals} saving={saving} label="Saqlash" />
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <Modal title="O'chirishni tasdiqlang" onClose={closeModals}>
          <p className="text-gray-600 text-sm mb-6">
            Bu fanni o'chirishni xohlaysizmi? Bu amalni qaytarib bo'lmaydi.
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
              {saving ? 'O\'chirilmoqda...' : 'O\'chirish'}
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function SubjectFormFields({
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
        <label className="block text-sm text-gray-600 mb-1">Fan nomi</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          placeholder="Masalan: Matematika"
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Oylik narxi (so'm)</label>
        <input
          type="number"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          required
          min="0"
          placeholder="Masalan: 300000"
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
