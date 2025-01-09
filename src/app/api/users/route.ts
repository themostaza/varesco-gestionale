import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { AuthError } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

function generateOTP() {
  return randomBytes(3).toString('hex').toUpperCase()
}

export async function GET() {
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()
    
    if (error) throw error

    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.user_metadata?.user_name || 'N/A',
      email: user.email || '',
      role: user.user_metadata?.role || 'na',
      registration_status: user.user_metadata?.registration_status || 'active',
      otp: user.user_metadata?.otp,
      otp_expires_at: user.user_metadata?.otp_expires_at
    }))

    return NextResponse.json(formattedUsers)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { name, email, role } = await request.json()
    
    // Generate OTP and expiration time (24 hours from now)
    const otp = generateOTP()
    const otp_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: otp, // Set OTP as temporary password
      email_confirm: true,
      user_metadata: { 
        user_name: name,
        role: role || 'collaboratore',
        registration_status: 'pending',
        otp,
        otp_expires_at
      }
    })

    if (error) throw error

    // Optional: Send email to user with OTP
    // await sendOTPEmail(email, otp)

    return NextResponse.json({
      ...data,
      user: {
        ...data.user,
        // Include these fields so they show up immediately in the UI
        user_metadata: {
          ...data.user?.user_metadata,
          otp,
          otp_expires_at
        }
      }
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name, role } = await request.json()
    
    // Get current metadata to preserve fields like otp and registration_status
    const { data: { user: currentUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(id)
    
    if (getUserError) throw getUserError

    const currentMetadata = currentUser?.user_metadata || {}
    
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      { 
        user_metadata: {
          ...currentMetadata,
          user_name: name,
          role: role,
        }
      }
    )

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}