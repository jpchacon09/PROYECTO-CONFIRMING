import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Sets Supabase session tokens into httpOnly cookies so server components and
// middleware can authenticate via `sb-access-token`.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      access_token?: string
      refresh_token?: string
    }

    if (!body?.access_token || !body?.refresh_token) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Missing tokens' } },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    cookieStore.set('sb-access-token', body.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })
    cookieStore.set('sb-refresh-token', body.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } },
      { status: 400 }
    )
  }
}

