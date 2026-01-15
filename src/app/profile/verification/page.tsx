import { createClient } from '@/lib/supabase/server'
import { VerificationCenter } from '@/components/profile/VerificationCenter'
import { redirect } from 'next/navigation'

export default async function VerificationPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login?redirect=/profile/verification')
    }

    const { data: profile } = await supabase
        .from('users_profile')
        .select('*')
        .eq('id', user.id)
        .single()

    return (
        <main className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <VerificationCenter userProfile={profile} />
        </main>
    )
}
