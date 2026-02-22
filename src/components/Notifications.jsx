import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import './Notifications.css'

function Notifications({ user, onBack }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userOptedIn, setUserOptedIn] = useState(null)

  useEffect(() => {
    checkUserOptIn()
  }, [user])

  const checkUserOptIn = async () => {
    try {
      const { data, error: optError } = await supabase
        .from('users')
        .select('leaderboard_opt_in')
        .eq('id', user.id)
        .single()

      if (optError) throw optError

      if (!data?.leaderboard_opt_in) {
        setUserOptedIn(false)
        setLoading(false)
        return
      }

      setUserOptedIn(true)
      fetchNotifications()
    } catch (err) {
      console.error('Error checking user opt-in status:', err)
      setError(err.message || 'Failed to check access')
      setLoading(false)
    }
  }

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      setError('')

      const { data, error: rpcError } = await supabase.rpc('get_notifications', { p_limit: 50 })

      if (rpcError) throw rpcError

      setNotifications(data || [])
    } catch (err) {
      console.error('Error fetching notifications:', err)
      setError(err.message || 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  const formatName = (firstName, lastName) => {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`.trim()
    }
    return `${firstName || ''} ${lastName || ''}`.trim() || 'Someone'
  }

  const formatTime = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getMessage = (n) => {
    const name = formatName(n.first_name, n.last_name)
    const payload = n.payload || {}
    switch (n.type) {
      case 'first_dump_at_location':
        return `${name} just logged their first dump at ${payload.location_name || 'a new location'}.`
      case 'milestone_ghost_wipe':
        return `${name} logged their ${payload.milestone_number || 10}th ghost wipe of the year.`
      case 'milestone_messy_dump':
        return `${name} logged their ${payload.milestone_number || 10}th messy dump of the year.`
      case 'milestone_liquid_dump':
        return `${name} logged their ${payload.milestone_number || 10}th liquid dump of the year.`
      case 'milestone_total':
        return `${name} has logged their ${payload.milestone_number || 100}th dump of the year.`
      case 'single_day_record_broken':
        return `${name} broke the single-day record with ${payload.dump_count || 0} dumps on ${payload.record_date || 'today'}.`
      default:
        return `${name} did something notable.`
    }
  }

  if (loading) {
    return (
      <div className="notifications-container">
        <div className="loading">Loading notifications...</div>
      </div>
    )
  }

  if (userOptedIn === false) {
    return (
      <div className="notifications-container">
        <div className="notifications-header">
          <button onClick={onBack} className="back-button">
            ← Back
          </button>
          <h1>🔔 Notifications</h1>
          <div style={{ width: '60px' }} />
        </div>
        <div className="access-denied">
          <div className="access-denied-icon">🔒</div>
          <h2>Access Restricted</h2>
          <p>You must opt in to view notifications.</p>
          <p>Go to Settings to enable leaderboard and notifications participation.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <button onClick={onBack} className="back-button">
          ← Back
        </button>
        <h1>🔔 Notifications</h1>
        <div style={{ width: '60px' }} />
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="notifications-content">
        {notifications.length === 0 ? (
          <div className="notifications-empty">No notifications yet.</div>
        ) : (
          <ul className="notifications-list">
            {notifications.map((n) => (
              <li key={n.id} className="notification-item">
                <p className="notification-message">{getMessage(n)}</p>
                <span className="notification-time">{formatTime(n.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default Notifications
