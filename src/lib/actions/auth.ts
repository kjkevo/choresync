'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ── Sign Up ───────────────────────────────────────────────────────────────────

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email    = formData.get('email')    as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      // Supabase sends a confirmation email; the link calls /auth/callback
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) return { error: error.message }

  // Don't redirect — show "check your email" message in the UI
  return { success: true }
}

// ── Log In ────────────────────────────────────────────────────────────────────

export async function logIn(formData: FormData) {
  const supabase = await createClient()

  const email    = formData.get('email')    as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

// ── Sign Out ──────────────────────────────────────────────────────────────────

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

// ── Forgot Password ───────────────────────────────────────────────────────────

export async function sendPasswordReset(formData: FormData) {
  const supabase = await createClient()
  const email    = formData.get('email') as string

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?type=recovery`,
  })

  if (error) return { error: error.message }

  return { success: true }
}

// ── Update Password (after reset link) ───────────────────────────────────────

export async function updatePassword(formData: FormData) {
  const supabase  = await createClient()
  const password  = formData.get('password') as string

  const { error } = await supabase.auth.updateUser({ password })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

// ── Update Profile ────────────────────────────────────────────────────────────

export async function updateProfile(formData: FormData) {
  const supabase  = await createClient()
  const fullName  = formData.get('fullName')  as string
  const avatarUrl = formData.get('avatarUrl') as string | null

  // 1. Update the auth user metadata
  const { error: metaError } = await supabase.auth.updateUser({
    data: {
      full_name:  fullName,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    },
  })

  if (metaError) return { error: metaError.message }

  // 2. Mirror the change in public.users (trigger keeps them in sync on auth
  //    events, but we also update directly so the change is instant)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { error: dbError } = await supabase
      .from('users')
      .update({
        full_name:  fullName,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      })
      .eq('id', user.id)

    if (dbError) return { error: dbError.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

// ── Upload Avatar ─────────────────────────────────────────────────────────────

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return { error: 'Not authenticated' }

  const file = formData.get('avatar') as File
  if (!file || file.size === 0) return { error: 'No file provided' }

  if (file.size > 5 * 1024 * 1024) return { error: 'File must be under 5 MB' }

  const ext      = file.name.split('.').pop() ?? 'jpg'
  const filePath = `${user.id}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true, contentType: file.type })

  if (uploadError) return { error: uploadError.message }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)

  // Bust cache by appending a timestamp
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`

  return { success: true, avatarUrl: publicUrl }
}
