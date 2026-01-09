import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import './Leaderboard.css'

function Leaderboard({ user, onBack }) {
  const [dailyStats, setDailyStats] = useState([])
  const [weeklyStats, setWeeklyStats] = useState([])
  const [yearly2026Stats, setYearly2026Stats] = useState([])
  const [ghostWipeRecords, setGhostWipeRecords] = useState([])
  const [messyDumpRecords, setMessyDumpRecords] = useState([])
  const [singleDayRecords, setSingleDayRecords] = useState([])
  const [singleLocationRecords, setSingleLocationRecords] = useState([])
  const [avgPerDayRecords, setAvgPerDayRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userOptedIn, setUserOptedIn] = useState(null)

  useEffect(() => {
    checkUserOptIn()
  }, [user])

  const checkUserOptIn = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('leaderboard_opt_in')
        .eq('id', user.id)
        .single()

      if (error) throw error

      if (!data?.leaderboard_opt_in) {
        setUserOptedIn(false)
        setLoading(false)
        return
      }

      setUserOptedIn(true)
      fetchLeaderboardData()
    } catch (err) {
      console.error('Error checking user opt-in status:', err)
      setError(err.message || 'Failed to check access')
      setLoading(false)
    }
  }

  const fetchLeaderboardData = async () => {
    try {
      setLoading(true)
      setError('')

      // Fetch all leaderboard data in parallel
      const [
        dailyResult,
        weeklyResult,
        yearly2026Result,
        ghostWipeResult,
        messyDumpResult,
        singleDayResult,
        singleLocationResult,
        avgPerDayResult,
      ] = await Promise.all([
        supabase.rpc('get_leaderboard_daily'),
        supabase.rpc('get_leaderboard_weekly'),
        supabase.rpc('get_leaderboard_2026'),
        supabase.rpc('get_leaderboard_ghost_wipes'),
        supabase.rpc('get_leaderboard_messy_dumps'),
        supabase.rpc('get_leaderboard_single_day_record'),
        supabase.rpc('get_leaderboard_single_location_record'),
        supabase.rpc('get_leaderboard_avg_per_day'),
      ])

      if (dailyResult.error) throw dailyResult.error
      if (weeklyResult.error) throw weeklyResult.error
      if (yearly2026Result.error) throw yearly2026Result.error
      if (ghostWipeResult.error) throw ghostWipeResult.error
      if (messyDumpResult.error) throw messyDumpResult.error
      if (singleDayResult.error) throw singleDayResult.error
      if (singleLocationResult.error) throw singleLocationResult.error
      if (avgPerDayResult.error) throw avgPerDayResult.error

      setDailyStats(dailyResult.data || [])
      setWeeklyStats(weeklyResult.data || [])
      setYearly2026Stats(yearly2026Result.data || [])
      setGhostWipeRecords(ghostWipeResult.data || [])
      setMessyDumpRecords(messyDumpResult.data || [])
      setSingleDayRecords(singleDayResult.data || [])
      setSingleLocationRecords(singleLocationResult.data || [])
      setAvgPerDayRecords(avgPerDayResult.data || [])
    } catch (err) {
      console.error('Error fetching leaderboard data:', err)
      setError(err.message || 'Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }

  const formatName = (firstName, lastName) => {
    // Only show names if both are provided (enforced by opt-in requirement)
    if (firstName && lastName) {
      return `${firstName} ${lastName}`.trim()
    }
    // Fallback - should not happen if database constraints are correct
    return `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown User'
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="leaderboard-container">
        <div className="loading">Loading leaderboard...</div>
      </div>
    )
  }

  if (userOptedIn === false) {
    return (
      <div className="leaderboard-container">
        <div className="leaderboard-header">
          <button onClick={onBack} className="back-button">
            ← Back
          </button>
          <h1>🏆 Leaderboard</h1>
          <div style={{ width: '60px' }}></div> {/* Spacer for centering */}
        </div>
        <div className="access-denied">
          <div className="access-denied-icon">🔒</div>
          <h2>Access Restricted</h2>
          <p>You must opt in to the leaderboard to view stats.</p>
          <p>Go to Settings to enable leaderboard participation.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <button onClick={onBack} className="back-button">
          ← Back
        </button>
        <h1>🏆 Leaderboard</h1>
        <div style={{ width: '60px' }}></div> {/* Spacer for centering */}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="leaderboard-content">
        {/* Daily Stats */}
        <div className="leaderboard-section">
          <h2>📅 Most Dumps Today</h2>
          <p className="leaderboard-description">Who's having the most productive day? These champions are really getting their money's worth from that morning coffee.</p>
          {dailyStats.length === 0 ? (
            <div className="empty-leaderboard">No dumps recorded today</div>
          ) : (
            <div className="leaderboard-list">
              {dailyStats.map((stat, index) => (
                <div key={stat.user_id} className="leaderboard-item">
                  <div className="rank-badge">{index + 1}</div>
                  <div className="leaderboard-info">
                    <div className="leaderboard-name">{formatName(stat.first_name, stat.last_name)}</div>
                    <div className="leaderboard-count">{stat.dump_count} {stat.dump_count === 1 ? 'dump' : 'dumps'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weekly Stats */}
        <div className="leaderboard-section">
          <h2>📆 Most Dumps This Week</h2>
          <p className="leaderboard-description">A week-long commitment to excellence. These folks are clearly on a roll (pun absolutely intended).</p>
          {weeklyStats.length === 0 ? (
            <div className="empty-leaderboard">No dumps recorded this week</div>
          ) : (
            <div className="leaderboard-list">
              {weeklyStats.map((stat, index) => (
                <div key={stat.user_id} className="leaderboard-item">
                  <div className="rank-badge">{index + 1}</div>
                  <div className="leaderboard-info">
                    <div className="leaderboard-name">{formatName(stat.first_name, stat.last_name)}</div>
                    <div className="leaderboard-count">{stat.dump_count} {stat.dump_count === 1 ? 'dump' : 'dumps'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Yearly 2026 Stats */}
        <div className="leaderboard-section">
          <h2>📊 Most Dumps of 2026</h2>
          <p className="leaderboard-description">The year isn't over yet, but these legends are already making history. Consistency is key, and they've got it down to a science.</p>
          {yearly2026Stats.length === 0 ? (
            <div className="empty-leaderboard">No dumps recorded in 2026</div>
          ) : (
            <div className="leaderboard-list">
              {yearly2026Stats.map((stat, index) => (
                <div key={stat.user_id} className="leaderboard-item">
                  <div className="rank-badge">{index + 1}</div>
                  <div className="leaderboard-info">
                    <div className="leaderboard-name">{formatName(stat.first_name, stat.last_name)}</div>
                    <div className="leaderboard-count">{stat.dump_count} {stat.dump_count === 1 ? 'dump' : 'dumps'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Records Section */}
        <div className="leaderboard-section records-section">
          <h2>🏅 Records</h2>

          <div className="record-category">
            <h3>👻 Most Ghost Wipes</h3>
            <p className="record-description">The holy grail of bathroom experiences. These masters achieve the impossible: a clean wipe with zero evidence. Pure wizardry.</p>
            {ghostWipeRecords.length === 0 ? (
              <div className="empty-leaderboard">No ghost wipes recorded</div>
            ) : (
              <div className="leaderboard-list">
                {ghostWipeRecords.map((record, index) => (
                  <div key={record.user_id} className="leaderboard-item">
                    <div className="rank-badge">{index + 1}</div>
                    <div className="leaderboard-info">
                      <div className="leaderboard-name">{formatName(record.first_name, record.last_name)}</div>
                      <div className="leaderboard-count">{record.ghost_wipe_count} {record.ghost_wipe_count === 1 ? 'ghost wipe' : 'ghost wipes'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="record-category">
            <h3>💩 Most Messy Dumps</h3>
            <p className="record-description">When things get real. These brave souls aren't afraid to admit when it got messy. Honesty is the best policy, even when it's sticky.</p>
            {messyDumpRecords.length === 0 ? (
              <div className="empty-leaderboard">No messy dumps recorded</div>
            ) : (
              <div className="leaderboard-list">
                {messyDumpRecords.map((record, index) => (
                  <div key={record.user_id} className="leaderboard-item">
                    <div className="rank-badge">{index + 1}</div>
                    <div className="leaderboard-info">
                      <div className="leaderboard-name">{formatName(record.first_name, record.last_name)}</div>
                      <div className="leaderboard-count">{record.messy_dump_count} {record.messy_dump_count === 1 ? 'messy dump' : 'messy dumps'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="record-category">
            <h3>📊 Highest in One Day</h3>
            <p className="record-description">When you really commit to a day. These record-holders turned a single 24-hour period into a marathon. Respect the dedication.</p>
            {singleDayRecords.length === 0 ? (
              <div className="empty-leaderboard">No single-day records</div>
            ) : (
              <div className="leaderboard-list">
                {singleDayRecords.map((record, index) => (
                  <div key={record.user_id} className="leaderboard-item">
                    <div className="rank-badge">{index + 1}</div>
                    <div className="leaderboard-info">
                      <div className="leaderboard-name">{formatName(record.first_name, record.last_name)}</div>
                      <div className="leaderboard-count">
                        {record.dump_count} {record.dump_count === 1 ? 'dump' : 'dumps'} on {formatDate(record.record_date)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="record-category">
            <h3>📍 Highest in One Location</h3>
            <p className="record-description">Home is where the heart is, and apparently where these people feel most comfortable. They've made their favorite spot a second home (literally).</p>
            {singleLocationRecords.length === 0 ? (
              <div className="empty-leaderboard">No location records</div>
            ) : (
              <div className="leaderboard-list">
                {singleLocationRecords.map((record, index) => (
                  <div key={`${record.user_id}-${record.location_name}`} className="leaderboard-item">
                    <div className="rank-badge">{index + 1}</div>
                    <div className="leaderboard-info">
                      <div className="leaderboard-name">{formatName(record.first_name, record.last_name)}</div>
                      <div className="leaderboard-count">
                        {record.dump_count} {record.dump_count === 1 ? 'dump' : 'dumps'} at {record.location_name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="record-category">
            <h3>📈 Highest Average Dumps Per Day</h3>
            <p className="record-description">Consistency is key, and these champions have it mastered. From account creation to today, they've maintained the highest daily average. That's commitment!</p>
            {avgPerDayRecords.length === 0 ? (
              <div className="empty-leaderboard">No average per day records</div>
            ) : (
              <div className="leaderboard-list">
                {avgPerDayRecords.map((record, index) => (
                  <div key={record.user_id} className="leaderboard-item">
                    <div className="rank-badge">{index + 1}</div>
                    <div className="leaderboard-info">
                      <div className="leaderboard-name">{formatName(record.first_name, record.last_name)}</div>
                      <div className="leaderboard-count">
                        {record.avg_dumps_per_day} {record.avg_dumps_per_day === 1 ? 'dump' : 'dumps'} per day average
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Leaderboard

