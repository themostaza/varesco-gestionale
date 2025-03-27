import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { AuthError } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { email, newPassword } = await request.json()
    
    if (!email || !newPassword) {
      return NextResponse.json(
        { error: 'Email and new password are required' },
        { status: 400 }
      )
    }

    // List all users and find the one with matching email
    const { data: { users }, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers()
    if (listUsersError) throw listUsersError

    const user = users.find(u => u.email === email)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Update user's password
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        password: newPassword,
        user_metadata: {
          ...user.user_metadata,
          registration_status: 'active'
        }
      }
    )

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        registration_status: data.user.user_metadata?.registration_status
      }
    })

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
} 