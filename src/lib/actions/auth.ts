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

  // Derive the site origin — prefer explicit env var, fall back to production URL
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'https://choresync-theta.vercel.app'

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name:  fullName,
        first_name: formData.get('firstName') as string | null,
        last_name:  formData.get('lastName')  as string | null,
      },
      // Supabase sends a confirmation email; clicking the link hits /auth/callback
      emailRedirectTo: `${siteUrl}/auth/callback?next=/onboarding`,
    },
  })

  if (error) return { error: error.message }

  // Don't redirect — show "check your email" message in the UI
  return { success: true }
}

// ── Log In ────────────────────────────────────────────────────────────────────

export async function logIn(formData: FormData) {
  const supabase = await createClient()

  const email      = formData.get('email')      as string
  const password   = formData.get('password')   as string
  const redirectTo = (formData.get('redirectTo') as string | null) ?? '/dashboard'

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect(redirectTo)
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
  const fullName  = (formData.get('fullName')  as string | null)?.trim() ?? null
  const avatarUrl = formData.get('avatarUrl')  as string | null
  const username  = (formData.get('username')  as string | null)?.trim().replace(/^@/, '') || null
  const tagline   = (formData.get('tagline')   as string | null)?.trim() || null

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // 1. Update auth metadata for name + avatar (kept in sync with public.users)
  if (fullName !== null || avatarUrl !== null) {
    const { error: metaError } = await supabase.auth.updateUser({
      data: {
        ...(fullName   !== null ? { full_name:  fullName  } : {}),
        ...(avatarUrl  !== null ? { avatar_url: avatarUrl } : {}),
      },
    })
    if (metaError) return { error: metaError.message }
  }

  // 2. Write all changed fields to public.users in one round-trip.
  // Only include a field in the patch when it was explicitly submitted in the
  // FormData — callers that only update name/avatar must not accidentally clear
  // username/tagline by omitting them.
  const patch: {
    full_name?:  string | null
    avatar_url?: string | null
    username?:   string | null
    tagline?:    string | null
  } = {}
  if (fullName  !== null)          patch.full_name  = fullName
  if (avatarUrl !== null)          patch.avatar_url = avatarUrl
  if (formData.has('username'))    patch.username   = username   // null = clear
  if (formData.has('tagline'))     patch.tagline    = tagline    // null = clear

  if (Object.keys(patch).length > 0) {
    const { error: dbError } = await supabase
      .from('users')
      .update(patch)
      .eq('id', user.id)

    if (dbError) return { error: dbError.message }
  }

  revalidatePath('/profile')
  return { success: true }
}

// ── Update Email (requires re-auth confirmation) ──────────────────────────────

export async function updateEmail(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return { error: 'Not authenticated' }

  const newEmail = (formData.get('newEmail') as string | null)?.trim()
  if (!newEmail) return { error: 'Email is required' }

  if (newEmail === user.email) return { error: 'New email is the same as current email' }

  // Email regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(newEmail)) return { error: 'Invalid email format' }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'https://choresync-theta.vercel.app'

  // Update auth email — sends verification to new email address
  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    {
      emailRedirectTo: `${siteUrl}/auth/callback?type=email_change`,
    }
  )

  if (error) return { error: error.message }

  // Return success but note that user must verify the new email
  return { success: true, message: `Verification link sent to ${newEmail}. Please check your email to confirm the change.` }
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
