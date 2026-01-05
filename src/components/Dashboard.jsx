import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import './Dashboard.css'

function Dashboard({ user }) {
  const [locations, setLocations] = useState([])
  const [newLocation, setNewLocation] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ensureUserExists()
  }, [user])

  const ensureUserExists = async () => {
    try {
      // Call database function to ensure user exists (bypasses RLS)
      const { error: rpcError } = await supabase.rpc('ensure_user_exists')

      if (rpcError) {
        console.error('Failed to ensure user exists:', rpcError)
        // If the function doesn't exist yet, try the fallback method
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()

        if (!existingUser) {
          setError('User record not found. Please contact support or try logging out and back in.')
          setLoading(false)
          return
        }
      }

      // Now fetch locations
      await fetchLocations()
    } catch (err) {
      console.error('Error ensuring user exists:', err)
      setError(err.message || 'Failed to initialize user')
      setLoading(false)
    }
  }

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('dumps')
        .select('*')
        .eq('user_id', user.id)
        .order('count', { ascending: false })

      if (error) throw error
      setLocations(data || [])
    } catch (err) {
      setError(err.message || 'Failed to fetch locations')
    } finally {
      setLoading(false)
    }
  }

  const handleAddLocation = async (e) => {
    e.preventDefault()
    if (!newLocation.trim()) return

    const locationName = newLocation.trim()
    setNewLocation('')
    setError('')

    try {
      // Ensure user exists before creating dump (call RPC function)
      await supabase.rpc('ensure_user_exists')

      // Check if location exists (case-insensitive)
      const { data: existing } = await supabase
        .from('dumps')
        .select('*')
        .eq('user_id', user.id)
        .ilike('location_name', locationName)
        .single()

      if (existing) {
        // Increment existing location
        const { data, error } = await supabase
          .from('dumps')
          .update({
            count: existing.count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) throw error

        setLocations((prev) => {
          const updated = prev.map((loc) => (loc.id === existing.id ? data : loc))
          // Sort by count descending
          return updated.sort((a, b) => b.count - a.count)
        })
      } else {
        // Create new location
        const { data, error } = await supabase
          .from('dumps')
          .insert({
            user_id: user.id,
            location_name: locationName,
            count: 1,
          })
          .select()
          .single()

        if (error) throw error

        setLocations((prev) => {
          const updated = [data, ...prev]
          // Sort by count descending
          return updated.sort((a, b) => b.count - a.count)
        })
      }
    } catch (err) {
      setError(err.message || 'Failed to add location')
    }
  }

  const handleIncrement = async (locationId) => {
    try {
      const location = locations.find((loc) => loc.id === locationId)
      if (!location) return

      const { data, error } = await supabase
        .from('dumps')
        .update({
          count: location.count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', locationId)
        .select()
        .single()

      if (error) throw error

      setLocations((prev) => {
        const updated = prev.map((loc) => (loc.id === locationId ? data : loc))
        // Sort by count descending
        return updated.sort((a, b) => b.count - a.count)
      })
    } catch (err) {
      setError(err.message || 'Failed to increment count')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading locations...</div>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <span className="emoji">🚽</span>
          <h1>Dump Tracker 2026</h1>
        </div>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>

      <form onSubmit={handleAddLocation} className="add-location-form">
        <input
          type="text"
          placeholder="Add Location (e.g., Home, Work, Starbucks)"
          value={newLocation}
          onChange={(e) => setNewLocation(e.target.value)}
          className="location-input"
        />
        <button type="submit" className="add-button">
          ➕ Add
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <div className="locations-list">
        {locations.length === 0 ? (
          <div className="empty-state">
            <p>No locations yet. Add your first location above!</p>
          </div>
        ) : (
          locations.map((location, index) => {
            const isTopLocation = index === 0 && locations.length > 0
            return (
              <div key={location.id} className="location-item">
                <div className="location-info">
                  <span className="location-name">
                    {isTopLocation && <span className="top-emoji">💩</span>}
                    {location.location_name}
                  </span>
                  <span className="location-count">Count: {location.count}</span>
                </div>
                <button
                  onClick={() => handleIncrement(location.id)}
                  className="increment-button"
                >
                  +1
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default Dashboard

