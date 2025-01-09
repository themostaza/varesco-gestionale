import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { AuthError } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

function generateOTP() {
  return randomBytes(3).toString('hex').toUpperCase()
}

export async function POST(request: Request) {
  try {
    const { id } = await request.json()
    
    // Get current user metadata
    const { data: { user: currentUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(id)
    if (getUserError) throw getUserError

    const currentMetadata = currentUser?.user_metadata || {}

    // Generate new OTP and expiration
    const otp = generateOTP()
    const otp_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    // Update user with new OTP and set status back to pending
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      {
        password: otp, // Set OTP as temporary password
        user_metadata: {
          ...currentMetadata,
          registration_status: 'pending',
          otp,
          otp_expires_at
        }
      }
    )

    if (error) throw error

    // Return updated user data
    return NextResponse.json({
      user: {
        id: data.user.id,
        name: data.user.user_metadata?.user_name || 'N/A',
        email: data.user.email || '',
        role: data.user.user_metadata?.role || 'na',
        registration_status: data.user.user_metadata?.registration_status,
        otp: data.user.user_metadata?.otp,
        otp_expires_at: data.user.user_metadata?.otp_expires_at
      }
    })

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}