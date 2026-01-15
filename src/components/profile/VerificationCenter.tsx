'use client'

import { useState, useEffect } from 'react'
import { Shield, CheckCircle2, AlertTriangle, Github, Linkedin, Mail, ExternalLink, ArrowRight, Lock } from 'lucide-react'
import Link from 'next/link'
import { VerificationBadge } from '@/components/ui/VerificationBadge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface VerificationStep {
    id: string
    title: string
    description: string
    icon: any
    status: 'complete' | 'pending' | 'action_required'
    points: number
    link?: string
}

export function VerificationCenter({ userProfile }: { userProfile: any }) {
    const [score, setScore] = useState(userProfile.trust_score || 0)
    const [loading, setLoading] = useState(false)

    const refreshScore = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/profile/calculate-trust', { method: 'POST' })
            const data = await res.json()
            if (data.score !== undefined) setScore(data.score)
        } finally {
            setTimeout(() => setLoading(false), 800) // Visual buffer for animation
        }
    }

    useEffect(() => {
        refreshScore()
    }, [])

    const steps: VerificationStep[] = [
        {
            id: 'email',
            title: 'Email Authenticity',
            description: 'Primary work or professional email address verified.',
            icon: Mail,
            status: userProfile.email_verified ? 'complete' : 'action_required',
            points: 20
        },
        {
            id: 'linkedin',
            title: 'Professional Identity',
            description: 'Connect your LinkedIn to verify your work history.',
            icon: Linkedin,
            status: userProfile.verification_data?.linkedin_connected ? 'complete' : 'action_required',
            points: 30,
            link: '#'
        },
        {
            id: 'github',
            title: 'Technical Proof',
            description: 'Sync your GitHub for technical skill verification.',
            icon: Github,
            status: userProfile.verification_data?.github_connected ? 'complete' : 'action_required',
            points: 20,
            link: '#'
        },
        {
            id: 'recruiter',
            title: 'Recruiter Status',
            description: 'Verify your company domain to post jobs with high-trust badges.',
            icon: Shield,
            status: userProfile.is_verified_recruiter ? 'complete' : 'pending',
            points: 30,
            link: '/recruiter/verify'
        }
    ]

    // Calculate percentage for radial progress
    const strokeDashoffset = 440 - (440 * score) / 100

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Premium Header / Hero */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1e1e2e] to-[#111119] p-8 text-white shadow-2xl border border-white/5">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 blur-[80px] rounded-full translate-y-1/2 -translate-x-1/2" />

                <div className="relative flex flex-col md:flex-row items-center gap-10">
                    {/* Radial Progress */}
                    <div className="relative flex-shrink-0">
                        <svg className="w-48 h-48 -rotate-90 transform">
                            <circle
                                className="text-white/5"
                                strokeWidth="12"
                                stroke="currentColor"
                                fill="transparent"
                                r="70"
                                cx="96"
                                cy="96"
                            />
                            <circle
                                className="text-primary-500 transition-all duration-1000 ease-out"
                                strokeWidth="12"
                                strokeDasharray="440"
                                style={{ strokeDashoffset }}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r="70"
                                cx="96"
                                cy="96"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-5xl font-bold tracking-tight">{score}</span>
                            <span className="text-xs uppercase tracking-widest text-white/40 font-semibold">Trust Score</span>
                        </div>
                    </div>

                    <div className="flex-1 space-y-4 text-center md:text-left">
                        <div className="flex items-center justify-between">
                            <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                                Trust Dashboard
                            </h1>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={refreshScore}
                                className={cn("text-white/40 hover:text-white/80 hover:bg-white/5 p-1 rounded-lg transition-all", loading && "animate-spin")}
                            >
                                <Lock className="w-4 h-4" />
                            </Button>
                        </div>
                        <p className="text-lg text-white/50 max-w-md">
                            Your Trust Score reflects the authenticity of your professional identity.
                            Higher scores unlock premium hiring tools and increased visibility.
                        </p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-2">
                            <VerificationBadge level={score > 80 ? 'gold' : 'blue'} label={score > 80 ? 'Elite Talent' : 'Verified Professional'} />
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-xs font-medium text-white/70">
                                <Lock className="w-3 h-3" />
                                End-to-end Encrypted
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Verification Steps Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {steps.map((step) => (
                    <Card key={step.id} className="group overflow-hidden border-none bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 border-none">
                            <div className={cn(
                                "p-3 rounded-2xl transition-colors duration-300",
                                step.status === 'complete' ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-400 group-hover:bg-primary-50 group-hover:text-primary-600"
                            )}>
                                <step.icon className="w-6 h-6" />
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Value</span>
                                <span className="text-sm font-bold text-gray-900">+{step.points} pts</span>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <CardTitle className="text-xl mb-1">{step.title}</CardTitle>
                                <p className="text-sm text-gray-500 line-clamp-2">{step.description}</p>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                {step.status === 'complete' ? (
                                    <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Verified
                                    </div>
                                ) : step.status === 'pending' ? (
                                    <div className="flex items-center gap-2 text-amber-500 font-semibold text-sm">
                                        <AlertTriangle className="w-4 h-4" />
                                        Reviewing
                                    </div>
                                ) : (
                                    <Link
                                        href={step.link || '#'}
                                        className="inline-flex items-center text-primary-600 hover:text-primary-700 font-bold group/btn transition-colors duration-200"
                                    >
                                        Complete Verification
                                        <ArrowRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                                    </Link>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Security Info Card */}
            <Card className="bg-blue-600 border-none text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-1/2 -translate-y-1/2" />
                <CardContent className="p-8 flex items-start gap-6 relative">
                    <div className="p-4 bg-white/10 rounded-2xl">
                        <Shield className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold">Privacy & Security Guarantee</h3>
                        <p className="text-blue-100/80 leading-relaxed">
                            We never share your raw data or credentials with third parties. Verification happens
                            manually or through secure zero-knowledge proofs. Your trust is our core product.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
