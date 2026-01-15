import React from 'react'
import { Shield, ShieldCheck, ShieldAlert } from 'lucide-react'

export type VerificationLevel = 'gold' | 'blue' | 'gray'

interface VerificationBadgeProps {
    level?: VerificationLevel
    label?: string
    className?: string
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
    level = 'gray',
    label,
    className = ''
}) => {
    const configs = {
        gold: {
            color: 'text-amber-500',
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            icon: ShieldCheck,
            defaultLabel: 'Verified Partner'
        },
        blue: {
            color: 'text-blue-500',
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            icon: Shield,
            defaultLabel: 'Identity Verified'
        },
        gray: {
            color: 'text-slate-400',
            bg: 'bg-slate-50',
            border: 'border-slate-200',
            icon: ShieldAlert,
            defaultLabel: 'Self-Reported'
        }
    }

    const { color, bg, border, icon: Icon, defaultLabel } = configs[level]

    return (
        <div className={`px-2 py-0.5 rounded-full border flex items-center gap-1.5 text-xs font-medium ${bg} ${border} ${color} ${className}`}>
            <Icon className="w-3 h-3" />
            <span>{label || defaultLabel}</span>
        </div>
    )
}
