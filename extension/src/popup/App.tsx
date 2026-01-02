import React, { useEffect, useState } from 'react'
import { REMOTEFLOW_URL } from '../lib/constants'

interface AuthStatus {
  authenticated: boolean
  user: {
    id: string
    email: string | null
  } | null
}

interface WeeklyStats {
  applicationsTracked: number
}

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [stats, setStats] = useState<WeeklyStats>({ applicationsTracked: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check auth status via background script
    chrome.runtime.sendMessage(
      { type: 'CHECK_AUTH', payload: {}, timestamp: Date.now() },
      (response: AuthStatus) => {
        setAuthStatus(response)
        setLoading(false)
      }
    )

    // Get weekly stats from storage
    chrome.storage.local.get(['weeklyApplications'], (result) => {
      if (result.weeklyApplications) {
        setStats({ applicationsTracked: result.weeklyApplications })
      }
    })
  }, [])

  const handleOpenRemoteFlow = () => {
    chrome.tabs.create({ url: `${REMOTEFLOW_URL}/saved` })
    window.close()
  }

  const handleSignIn = () => {
    chrome.tabs.create({ url: `${REMOTEFLOW_URL}/login` })
    window.close()
  }

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading-container">
          <div className="loading-spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="popup-container">
      {/* Header */}
      <header className="popup-header">
        <img
          src="/icons/icon48.svg"
          alt="RemoteFlow"
          className="popup-logo"
        />
        <h1 className="popup-title">RemoteFlow</h1>
      </header>

      {/* Auth Section */}
      <section className="auth-section">
        <div className="auth-status">
          <span
            className={`status-indicator ${
              authStatus?.authenticated ? 'authenticated' : 'unauthenticated'
            }`}
          />
          <span className="status-text">
            {authStatus?.authenticated ? 'Logged in' : 'Not logged in'}
          </span>
        </div>

        {authStatus?.authenticated && authStatus.user?.email && (
          <p className="user-email">{authStatus.user.email}</p>
        )}

        {authStatus?.authenticated ? (
          <button className="btn btn-primary" onClick={handleOpenRemoteFlow}>
            Open RemoteFlow
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleSignIn}>
            Sign in to RemoteFlow
          </button>
        )}
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <span className="stats-label">This Week</span>
        <span className="stats-value">{stats.applicationsTracked}</span>
        <span className="stats-description">applications tracked</span>
      </section>

      {/* Footer */}
      <footer className="popup-footer">
        <a
          href={REMOTEFLOW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link"
          onClick={(e) => {
            e.preventDefault()
            chrome.tabs.create({ url: REMOTEFLOW_URL })
            window.close()
          }}
        >
          remoteflow.io
        </a>
      </footer>
    </div>
  )
}
