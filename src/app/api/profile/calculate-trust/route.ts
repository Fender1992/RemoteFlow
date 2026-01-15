import { createClient } from '@/lib/supabase/server'
import { calculateTrustScore } from '@/lib/quality/verification'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const result = await calculateTrustScore(supabase, user.id)
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Trust score calculation failed:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
