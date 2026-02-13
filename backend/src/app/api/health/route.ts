import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      supabase: 'connected', // TODO: verificar conexión real
      s3: 'connected' // TODO: verificar conexión real
    }
  })
}
