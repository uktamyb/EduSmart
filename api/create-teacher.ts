import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, password, full_name, org_id, teacher_table_id } = req.body as {
    email: string
    password: string
    full_name: string
    org_id: string
    teacher_table_id: string
  }

  if (!email || !password || !full_name || !org_id) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Create auth user (email_confirm: true skips confirmation email)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return res.status(400).json({ error: authError?.message ?? 'Auth user yaratishda xatolik' })
  }

  // Insert into users table
  const { error: insertError } = await supabaseAdmin.from('users').insert({
    id: authData.user.id,
    org_id,
    full_name,
    email,
    role: 'teacher',
  })

  if (insertError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return res.status(400).json({ error: insertError.message })
  }

  // Ensure the teachers table row has the email set (for profile lookup on login)
  if (teacher_table_id) {
    await supabaseAdmin
      .from('teachers')
      .update({ email })
      .eq('id', teacher_table_id)
  }

  return res.status(200).json({ success: true })
}
