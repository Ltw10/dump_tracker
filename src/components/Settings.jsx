import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import './Settings.css'

function Settings({ user, onBack }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(false)
  const [locationTrackingOptIn, setLocationTrackingOptIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchUserSettings()
  }, [user])

  const fetchUserSettings = async () => {
    try {
      // Verify we have a valid user object
      if (!user || !user.id) {
        setError('User session invalid. Please log out and log back in.')
        setLoading(false)
        return
      }

      // Get the authenticated user to ensure we're fetching the correct account
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser || authUser.id !== user.id) {
        setError('Authentication mismatch. Please log out and log back in.')
        setLoading(false)
        return
      }

      // Use the authenticated user's ID explicitly
      const userId = authUser.id
      
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, leaderboard_opt_in, location_tracking_opt_in')
        .eq('id', userId)
        .single()

      if (error) throw error

      // Verify we fetched the correct user's data
      if (!data || data.id !== userId) {
        throw new Error('Failed to verify user data. Please try again.')
      }

      // Pre-fill form fields with existing user data
      // Handle null/undefined values by converting to empty string
      setFirstName(data.first_name ? String(data.first_name).trim() : '')
      setLastName(data.last_name ? String(data.last_name).trim() : '')
      setLeaderboardOptIn(data.leaderboard_opt_in === true)
      setLocationTrackingOptIn(data.location_tracking_opt_in === true)
    } catch (err) {
      console.error('Error fetching user settings:', err)
      setError(err.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleLeaderboardToggle = (checked) => {
    const firstNameTrimmed = firstName.trim()
    const lastNameTrimmed = lastName.trim()

    if (checked && (!firstNameTrimmed || !lastNameTrimmed)) {
      setError('Please set both first name and last name before opting in to the leaderboard.')
      return
    }

    setError('')
    setLeaderboardOptIn(checked)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    // Verify we have a valid user object
    if (!user || !user.id) {
      setError('User session invalid. Please log out and log back in.')
      setSaving(false)
      return
    }

    // Double-check that the authenticated user matches the user object
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser || authUser.id !== user.id) {
      setError('Authentication mismatch. Please log out and log back in.')
      setSaving(false)
      return
    }

    const firstNameTrimmed = firstName.trim()
    const lastNameTrimmed = lastName.trim()

    // Validate that if leaderboard opt-in is enabled, both names must be set
    if (leaderboardOptIn && (!firstNameTrimmed || !lastNameTrimmed)) {
      setError('Please set both first name and last name before opting in to the leaderboard.')
      setSaving(false)
      return
    }

    try {
      // Use the authenticated user's ID explicitly to ensure we're updating the correct account
      const userId = authUser.id
      
      // Prepare update data - use empty string instead of null for better compatibility
      const updateData = {
        first_name: firstNameTrimmed || null,
        last_name: lastNameTrimmed || null,
        leaderboard_opt_in: leaderboardOptIn,
        location_tracking_opt_in: locationTrackingOptIn,
      }

      console.log('Attempting to update user:', userId, 'with data:', updateData)

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select('id, first_name, last_name, leaderboard_opt_in, location_tracking_opt_in')
        .single()

      if (error) {
        console.error('Supabase update error:', error)
        throw error
      }

      console.log('Update response:', data)

      // Verify the update was for the correct user
      if (!data || data.id !== userId) {
        console.error('Update verification failed. Expected user:', userId, 'Got:', data?.id)
        throw new Error('Update verification failed. Please try again.')
      }

      // Update local state with the saved values
      setFirstName(data.first_name ? String(data.first_name).trim() : '')
      setLastName(data.last_name ? String(data.last_name).trim() : '')
      setLeaderboardOptIn(data.leaderboard_opt_in === true)
      setLocationTrackingOptIn(data.location_tracking_opt_in === true)

      setSuccess('Settings saved successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error saving settings:', err)
      console.error('Error details:', {
        message: err.message,
        details: err.details,
        hint: err.hint,
        code: err.code
      })
      setError(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="settings-container">
        <div className="loading">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <button onClick={onBack} className="back-button">
          ← Back
        </button>
        <h1>Settings</h1>
        <div style={{ width: '60px' }}></div> {/* Spacer for centering */}
      </div>

      <form onSubmit={handleSave} className="settings-form">
        <div className="settings-section">
          <h2>Profile Information</h2>
          
          <div className="form-group">
            <label htmlFor="firstName">First Name</label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value)
                if (error && e.target.value.trim() && lastName.trim()) {
                  setError('')
                }
              }}
              placeholder="Enter your first name"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="lastName">Last Name</label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value)
                if (error && firstName.trim() && e.target.value.trim()) {
                  setError('')
                }
              }}
              placeholder="Enter your last name"
              className="form-input"
            />
          </div>
        </div>

        <div className="settings-section">
          <h2>Leaderboard</h2>
          
          <div className="toggle-group">
            <label htmlFor="leaderboardOptIn" className="toggle-label">
              <span className="toggle-text">
                <strong>Opt in to Dump Tracker Leaderboard</strong>
                <span className="toggle-description">
                  Allow your name and stats to appear on the leaderboard and in notifications
                </span>
              </span>
              <div className="toggle-switch">
                <input
                  id="leaderboardOptIn"
                  type="checkbox"
                  checked={leaderboardOptIn}
                  onChange={(e) => handleLeaderboardToggle(e.target.checked)}
                  className="toggle-input"
                />
                <span className="toggle-slider"></span>
              </div>
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h2>Location Tracking</h2>
          
          <div className="toggle-group">
            <label htmlFor="locationTrackingOptIn" className="toggle-label">
              <span className="toggle-text">
                <strong>Enable Location Tracking</strong>
                <span className="toggle-description">
                  Allow the app to prompt you to add specific location data (address or GPS coordinates) for your dump locations
                </span>
              </span>
              <div className="toggle-switch">
                <input
                  id="locationTrackingOptIn"
                  type="checkbox"
                  checked={locationTrackingOptIn}
                  onChange={(e) => setLocationTrackingOptIn(e.target.checked)}
                  className="toggle-input"
                />
                <span className="toggle-slider"></span>
              </div>
            </label>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <button 
          type="submit" 
          className="save-button"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}

export default Settings

