'use client'

import { useState } from 'react'
import { VerificationBadge } from '@/components/ui/VerificationBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ShieldCheck, Mail, Globe, AlertCircle } from 'lucide-react'

export default function RecruiterVerifyPage() {
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        // Logic to call verifyRecruiter API would go here
        // Simulation for demo purposes:
        setTimeout(() => {
            setSuccess(true)
            setLoading(false)
        }, 1500)
    }

    if (success) {
        return (
            <div className="max-w-2xl mx-auto p-8 text-center">
                <div className="mb-6 flex justify-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                        <ShieldCheck className="w-10 h-10 text-blue-600" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold mb-2">Verification Request Submitted</h1>
                <p className="text-slate-600 mb-8">
                    We are checking your email domain against the company website.
                    You will see the "Verified Recruiter" badge on your job posts once confirmed.
                </p>
                <VerificationBadge level="blue" label="Pending Verification" className="mx-auto" />
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto p-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-blue-600" />
                        Recruiter Verification
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-slate-600 mb-6">
                        Verified recruiters get priority placement in search results and a "Verified Job"
                        badge on their listings. This increases applicant trust and response rates.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Mail className="w-4 h-4" /> Professional Email
                            </label>
                            <input
                                type="email"
                                placeholder="you@company.com"
                                className="w-full p-2 border rounded-md"
                                required
                            />
                            <p className="text-xs text-slate-500">Must match your company's website domain.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Globe className="w-4 h-4" /> Company Website
                            </label>
                            <input
                                type="url"
                                placeholder="https://company.com"
                                className="w-full p-2 border rounded-md"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-md flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Verifying...' : 'Submit Verification Request'}
                        </button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
