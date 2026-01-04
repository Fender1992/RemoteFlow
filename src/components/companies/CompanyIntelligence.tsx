'use client'

import { cn } from '@/lib/utils'
import { CredibilityBadge } from './CredibilityBadge'

interface CompanyIntelligenceProps {
  company: {
    name: string
    credibilityGrade?: string
    credibilityScore?: number
    metrics?: {
      responseRate?: number        // 0-1
      avgTimeToFillDays?: number
      fillRate?: number            // 0-1
      activeJobs?: number
      hiringTrend?: 'growing' | 'stable' | 'declining'
    }
    redFlags?: string[]
  }
  className?: string
}

// Icons
const MailIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const TrendingUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
)

const TrendingDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
  </svg>
)

const MinusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
  </svg>
)

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
)

// Helper functions for color determination
function getResponseRateColor(rate?: number): { text: string; bg: string; status: 'good' | 'fair' | 'poor' } {
  if (rate === undefined) return { text: 'text-gray-500', bg: 'bg-gray-100', status: 'fair' }
  if (rate > 0.5) return { text: 'text-[var(--health-good-text)]', bg: 'bg-[var(--health-good-bg)]', status: 'good' }
  if (rate >= 0.2) return { text: 'text-[var(--health-caution-text)]', bg: 'bg-[var(--health-caution-bg)]', status: 'fair' }
  return { text: 'text-[var(--health-danger-text)]', bg: 'bg-[var(--health-danger-bg)]', status: 'poor' }
}

function getTimeToHireColor(days?: number): { text: string; bg: string; status: 'good' | 'fair' | 'poor' } {
  if (days === undefined) return { text: 'text-gray-500', bg: 'bg-gray-100', status: 'fair' }
  if (days < 30) return { text: 'text-[var(--health-good-text)]', bg: 'bg-[var(--health-good-bg)]', status: 'good' }
  if (days <= 60) return { text: 'text-[var(--health-caution-text)]', bg: 'bg-[var(--health-caution-bg)]', status: 'fair' }
  return { text: 'text-[var(--health-danger-text)]', bg: 'bg-[var(--health-danger-bg)]', status: 'poor' }
}

function getFillRateColor(rate?: number): { text: string; bg: string; status: 'good' | 'fair' | 'poor' } {
  if (rate === undefined) return { text: 'text-gray-500', bg: 'bg-gray-100', status: 'fair' }
  if (rate > 0.7) return { text: 'text-[var(--health-good-text)]', bg: 'bg-[var(--health-good-bg)]', status: 'good' }
  if (rate >= 0.4) return { text: 'text-[var(--health-caution-text)]', bg: 'bg-[var(--health-caution-bg)]', status: 'fair' }
  return { text: 'text-[var(--health-danger-text)]', bg: 'bg-[var(--health-danger-bg)]', status: 'poor' }
}

function getTrendColor(trend?: 'growing' | 'stable' | 'declining'): { text: string; bg: string } {
  if (trend === 'growing') return { text: 'text-[var(--health-good-text)]', bg: 'bg-[var(--health-good-bg)]' }
  if (trend === 'declining') return { text: 'text-[var(--health-danger-text)]', bg: 'bg-[var(--health-danger-bg)]' }
  return { text: 'text-gray-600', bg: 'bg-gray-100' }
}

function getTrendIcon(trend?: 'growing' | 'stable' | 'declining') {
  if (trend === 'growing') return TrendingUpIcon
  if (trend === 'declining') return TrendingDownIcon
  return MinusIcon
}

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  colors: { text: string; bg: string }
}

function MetricCard({ icon: Icon, label, value, colors }: MetricCardProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-4 rounded-lg', colors.bg)}>
      <Icon className={cn('w-5 h-5 mb-2', colors.text)} />
      <span className={cn('text-lg font-semibold', colors.text)}>{value}</span>
      <span className="text-xs text-gray-600 mt-1">{label}</span>
    </div>
  )
}

export function CompanyIntelligence({ company, className }: CompanyIntelligenceProps) {
  const { metrics, redFlags } = company

  const responseRateColors = getResponseRateColor(metrics?.responseRate)
  const timeToHireColors = getTimeToHireColor(metrics?.avgTimeToFillDays)
  const fillRateColors = getFillRateColor(metrics?.fillRate)
  const trendColors = getTrendColor(metrics?.hiringTrend)
  const TrendIcon = getTrendIcon(metrics?.hiringTrend)

  const formatRate = (rate?: number) => {
    if (rate === undefined) return 'N/A'
    return `${Math.round(rate * 100)}%`
  }

  const formatDays = (days?: number) => {
    if (days === undefined) return 'N/A'
    return `${days}d`
  }

  const formatTrend = (trend?: 'growing' | 'stable' | 'declining') => {
    if (!trend) return 'N/A'
    return trend.charAt(0).toUpperCase() + trend.slice(1)
  }

  return (
    <div className={cn('bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] shadow-sm', className)}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border-default)]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">{company.name}</h3>
          <CredibilityBadge
            grade={company.credibilityGrade}
            score={company.credibilityScore}
            size="sm"
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            icon={MailIcon}
            label="Response Rate"
            value={formatRate(metrics?.responseRate)}
            colors={responseRateColors}
          />
          <MetricCard
            icon={ClockIcon}
            label="Avg Time to Hire"
            value={formatDays(metrics?.avgTimeToFillDays)}
            colors={timeToHireColors}
          />
          <MetricCard
            icon={CheckCircleIcon}
            label="Fill Rate"
            value={formatRate(metrics?.fillRate)}
            colors={fillRateColors}
          />
          <MetricCard
            icon={TrendIcon}
            label="Hiring Trend"
            value={formatTrend(metrics?.hiringTrend)}
            colors={trendColors}
          />
        </div>
      </div>

      {/* Red Flags Section */}
      {redFlags && redFlags.length > 0 && (
        <div className="px-5 py-4 border-t border-[var(--border-default)]">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-amber-800 mb-2">Red Flags</h4>
                <ul className="space-y-1">
                  {redFlags.map((flag, index) => (
                    <li key={index} className="text-sm text-amber-700 flex items-start gap-2">
                      <span className="text-amber-500 mt-1">•</span>
                      <span>{flag}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CompanyIntelligence
