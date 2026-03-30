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

interface CredForm {
  email: string
  password: string
}

const emptyForm: FormState = { full_name: '', phone: '', email: '' }

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefghjkmnpqrstwxyz23456789'
  let pwd = ''
  for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  return pwd + '!'
}

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

  // Credential creation state
  const [credTeacher, setCredTeacher] = useState<Teacher | null>(null)
  const [credForm, setCredForm] = useState<CredForm>({ email: '', password: '' })
  const [credSaving, setCredSaving] = useState(false)
  const [credError, setCredError] = useState('')
  const [credSuccess, setCredSuccess] = useState(false)
  const [teacherEmails, setTeacherEmails] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (org?.id) {
      fetchTeachers()
      fetchTeacherUsers(org.id)
    }
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

  async function fetchTeacherUsers(orgId: string) {
    const { data } = await supabase
      .from('users')
      .select('email')
      .eq('org_id', orgId)
      .eq('role', 'teacher')
    if (data) setTeacherEmails(new Set(data.map((u) => u.email).filter(Boolean) as string[]))
  }

  function openAdd() { setForm(emptyForm); setError(''); setShowAddModal(true) }

  function openEdit(teacher: Teacher) {
    setForm({ full_name: teacher.full_name, phone: teacher.phone ?? '', email: teacher.email ?? '' })
    setError('')
    setEditingId(teacher.id)
  }

  function openCred(teacher: Teacher) {
    setCredForm({ email: teacher.email ?? '', password: generatePassword() })
    setCredError('')
    setCredSuccess(false)
    setCredTeacher(teacher)
  }

  function closeModals() {
    setShowAddModal(false); setEditingId(null); setDeleteId(null)
    setCredTeacher(null); setForm(emptyForm); setError('')
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const { error } = await supabase.from('teachers').insert({
      org_id: org!.id,
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
    })
    if (error) { setError(error.message) } else { await fetchTeachers(); closeModals() }
    setSaving(false)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setSaving(true); setError('')
    const { error } = await supabase.from('teachers').update({
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
    }).eq('id', editingId)
    if (error) { setError(error.message) } else { await fetchTeachers(); closeModals() }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    setSaving(true)
    const { error } = await supabase.from('teachers').delete().eq('id', deleteId)
    if (!error) { setTeachers((prev) => prev.filter((t) => t.id !== deleteId)); setDeleteId(null) }
    setSaving(false)
  }

  async function handleCreateCred(e: React.FormEvent) {
    e.preventDefault()
    if (!credTeacher || !org) return
    setCredSaving(true); setCredError('')

    const res = await fetch('/api/create-teacher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: credForm.email.trim(),
        password: credForm.password,
        full_name: credTeacher.full_name,
        org_id: org.id,
        teacher_table_id: credTeacher.id,
      }),
    })
    const json = await res.json() as { success?: boolean; error?: string }

    if (json.error) {
      setCredError(json.error)
    } else {
      setCredSuccess(true)
      await fetchTeacherUsers(org.id)
      await fetchTeachers()
    }
    setCredSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">O'qituvchilar</h1>
        <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
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
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">#</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Ism familiya</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Telefon</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Email</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium">Login</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {teachers.map((teacher, i) => {
                  const hasAuth = !!teacher.email && teacherEmails.has(teacher.email)
                  return (
                    <tr key={teacher.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">{teacher.full_name}</td>
                      <td className="px-4 py-3 text-gray-600">{teacher.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{teacher.email ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {hasAuth ? (
                          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Aktiv</span>
                        ) : (
                          <button
                            onClick={() => openCred(teacher)}
                            className="text-xs font-medium text-purple-600 hover:underline"
                          >
                            Yaratish
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => openEdit(teacher)} className="text-blue-600 hover:underline text-xs">Tahrirlash</button>
                        <button onClick={() => setDeleteId(teacher.id)} className="text-red-500 hover:underline text-xs">O'chirish</button>
                      </td>
                    </tr>
                  )
                })}
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
          <p className="text-gray-600 text-sm mb-6">Bu o'qituvchini o'chirishni xohlaysizmi? Bu amalni qaytarib bo'lmaydi.</p>
          <div className="flex justify-end gap-2">
            <button onClick={closeModals} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Bekor qilish</button>
            <button onClick={handleDelete} disabled={saving} className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50">
              {saving ? "O'chirilmoqda..." : "O'chirish"}
            </button>
          </div>
        </Modal>
      )}

      {/* Credentials Modal */}
      {credTeacher && (
        <Modal title={`Kirish ma'lumotlari — ${credTeacher.full_name}`} onClose={closeModals}>
          {credSuccess ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded p-4 text-sm text-green-800">
                <p className="font-semibold mb-2">✓ Login muvaffaqiyatli yaratildi!</p>
                <p>Email: <span className="font-mono">{credForm.email}</span></p>
                <p>Parol: <span className="font-mono">{credForm.password}</span></p>
              </div>
              <p className="text-xs text-gray-500">Bu ma'lumotlarni o'qituvchiga yetkazing.</p>
              <div className="flex justify-end">
                <button onClick={closeModals} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Yopish</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateCred} className="space-y-4">
              {credError && <p className="text-red-500 text-sm">{credError}</p>}
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={credForm.email}
                  onChange={(e) => setCredForm({ ...credForm, email: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Parol</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={credForm.password}
                    onChange={(e) => setCredForm({ ...credForm, password: e.target.value })}
                    className="flex-1 border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setCredForm({ ...credForm, password: generatePassword() })}
                    className="px-3 py-2 text-xs border rounded hover:bg-gray-50 whitespace-nowrap"
                  >
                    Yangilash
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModals} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Bekor qilish</button>
                <button type="submit" disabled={credSaving} className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">
                  {credSaving ? 'Yaratilmoqda...' : 'Login yaratish'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function TeacherFormFields({ form, setForm, error }: { form: FormState; setForm: (f: FormState) => void; error: string }) {
  return (
    <>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div>
        <label className="block text-sm text-gray-600 mb-1">Ism familiya</label>
        <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required placeholder="Masalan: Ali Valiyev" className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Telefon</label>
        <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998 90 123 45 67" className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Email</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ali@example.com" className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
    </>
  )
}

function ModalActions({ onCancel, saving, label }: { onCancel: () => void; saving: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Bekor qilish</button>
      <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
        {saving ? 'Saqlanmoqda...' : label}
      </button>
    </div>
  )
}
