import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import './Notifications.css'

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'specialty', label: 'Specialty dumps' },
  { value: 'total', label: 'Total dumps' },
  { value: 'location', label: 'Location' },
]

const SPECIALTY_TYPES = ['milestone_ghost_wipe', 'milestone_messy_dump', 'milestone_liquid_dump', 'milestone_explosive_dump']
const PAGE_SIZE = 10

function Notifications({ user, onBack }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userOptedIn, setUserOptedIn] = useState(null)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    checkUserOptIn()
  }, [user])

  const checkUserOptIn = async () => {
    try {
      const { data, error: optError } = await supabase
        .from('dt_users')
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

      const { data, error: rpcError } = await supabase.rpc('dt_get_notifications', { p_limit: 50 })

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

  const filteredNotifications = (() => {
    if (filter === 'all') return notifications
    if (filter === 'specialty') return notifications.filter((n) => SPECIALTY_TYPES.includes(n.type))
    if (filter === 'total') return notifications.filter((n) => n.type === 'milestone_total')
    if (filter === 'location') return notifications.filter((n) => n.type === 'first_dump_at_location' || n.type === 'milestone_location_50')
    return notifications
  })()

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  const handleFilterChange = (value) => {
    setFilter(value)
    setPage(1)
  }

  const getMessage = (n) => {
    const name = formatName(n.first_name, n.last_name)
    const payload = n.payload || {}
    switch (n.type) {
      case 'first_dump_at_location':
        return `${name} just logged their first dump at ${payload.location_name || 'a new location'}.`
      case 'milestone_location_50':
        return `${name} logged their ${payload.milestone_number || 50}th dump at ${payload.location_name || 'a location'}.`
      case 'milestone_ghost_wipe':
        return `${name} logged their ${payload.milestone_number || 10}th ghost wipe of the year.`
      case 'milestone_messy_dump':
        return `${name} logged their ${payload.milestone_number || 10}th messy dump of the year.`
      case 'milestone_liquid_dump':
        return `${name} logged their ${payload.milestone_number || 10}th liquid dump of the year.`
      case 'milestone_explosive_dump':
        return `${name} logged their ${payload.milestone_number || 10}th explosive dump of the year.`
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

      <div className="notifications-filters">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleFilterChange(opt.value)}
            className={`notifications-filter-btn ${filter === opt.value ? 'active' : ''}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="notifications-content">
        {filteredNotifications.length === 0 ? (
          <div className="notifications-empty">
            {notifications.length === 0 ? 'No notifications yet.' : `No ${FILTER_OPTIONS.find((o) => o.value === filter)?.label?.toLowerCase() || filter} notifications.`}
          </div>
        ) : (
          <>
            <ul className="notifications-list">
              {paginatedNotifications.map((n) => (
                <li key={n.id} className="notification-item">
                  <p className="notification-message">{getMessage(n)}</p>
                  <span className="notification-time">{formatTime(n.created_at)}</span>
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <div className="notifications-pagination">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="notifications-page-btn"
                  disabled={currentPage <= 1}
                >
                  ← Previous
                </button>
                <span className="notifications-page-info">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="notifications-page-btn"
                  disabled={currentPage >= totalPages}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Notifications
