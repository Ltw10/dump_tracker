import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import './Dashboard.css'

function Dashboard({ user }) {
  const [locations, setLocations] = useState([])
  const [newLocation, setNewLocation] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedLocation, setSelectedLocation] = useState(null)

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
        // Create a new dump entry for existing location
        const { error: entryError } = await supabase
          .from('dump_entries')
          .insert({
            dump_id: existing.id,
            user_id: user.id,
          })

        if (entryError) {
          // Fallback to old method if dump_entries table doesn't exist yet
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
            return updated.sort((a, b) => b.count - a.count)
          })
          return
        }

        // Fetch updated location after entry is created
        const { data, error } = await supabase
          .from('dumps')
          .select('*')
          .eq('id', existing.id)
          .single()

        if (error) throw error

        setLocations((prev) => {
          const updated = prev.map((loc) => (loc.id === existing.id ? data : loc))
          return updated.sort((a, b) => b.count - a.count)
        })
      } else {
        // Create new location
        const { data: newDump, error } = await supabase
          .from('dumps')
          .insert({
            user_id: user.id,
            location_name: locationName,
            count: 1,
          })
          .select()
          .single()

        if (error) throw error

        // Create the first dump entry
        const { error: entryError } = await supabase
          .from('dump_entries')
          .insert({
            dump_id: newDump.id,
            user_id: user.id,
          })

        // If dump_entries doesn't exist, that's okay - the count is already set to 1
        if (entryError) {
          console.warn('dump_entries table may not exist yet:', entryError)
        }

        setLocations((prev) => {
          const updated = [newDump, ...prev]
          return updated.sort((a, b) => b.count - a.count)
        })
      }
    } catch (err) {
      setError(err.message || 'Failed to add location')
    }
  }

  const handleIncrement = async (locationId, e) => {
    e?.stopPropagation() // Prevent triggering location click
    try {
      const location = locations.find((loc) => loc.id === locationId)
      if (!location) return

      // Create a new dump entry (this will trigger the count sync via trigger)
      const { error: entryError } = await supabase
        .from('dump_entries')
        .insert({
          dump_id: locationId,
          user_id: user.id,
        })

      if (entryError) {
        // Fallback to old method if dump_entries table doesn't exist yet
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
          return updated.sort((a, b) => b.count - a.count)
        })

        if (selectedLocation?.id === locationId) {
          setSelectedLocation(data)
        }
        return
      }

      // Fetch updated location after entry is created
      const { data, error } = await supabase
        .from('dumps')
        .select('*')
        .eq('id', locationId)
        .single()

      if (error) throw error

      setLocations((prev) => {
        const updated = prev.map((loc) => (loc.id === locationId ? data : loc))
        return updated.sort((a, b) => b.count - a.count)
      })

      // Update selected location if modal is open
      if (selectedLocation?.id === locationId) {
        setSelectedLocation(data)
      }
    } catch (err) {
      setError(err.message || 'Failed to increment count')
    }
  }

  const handleDecrement = async (locationId) => {
    try {
      const location = locations.find((loc) => loc.id === locationId)
      if (!location) return

      // Don't allow count to go below 0
      if (location.count <= 0) return

      // Find and delete the most recent dump entry for this location
      const { data: recentEntry, error: findError } = await supabase
        .from('dump_entries')
        .select('id')
        .eq('dump_id', locationId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (findError) {
        // Fallback to old method if dump_entries table doesn't exist yet
        const newCount = location.count - 1
        const { data, error } = await supabase
          .from('dumps')
          .update({
            count: newCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', locationId)
          .select()
          .single()

        if (error) throw error

        setLocations((prev) => {
          const updated = prev.map((loc) => (loc.id === locationId ? data : loc))
          return updated.sort((a, b) => b.count - a.count)
        })

        if (selectedLocation?.id === locationId) {
          setSelectedLocation(data)
        }
        return
      }

      // Delete the most recent entry (this will trigger count sync via trigger)
      const { error: deleteError } = await supabase
        .from('dump_entries')
        .delete()
        .eq('id', recentEntry.id)

      if (deleteError) throw deleteError

      // Fetch updated location after entry is deleted
      const { data, error } = await supabase
        .from('dumps')
        .select('*')
        .eq('id', locationId)
        .single()

      if (error) throw error

      setLocations((prev) => {
        const updated = prev.map((loc) => (loc.id === locationId ? data : loc))
        return updated.sort((a, b) => b.count - a.count)
      })

      // Update selected location if modal is open
      if (selectedLocation?.id === locationId) {
        setSelectedLocation(data)
      }
    } catch (err) {
      setError(err.message || 'Failed to decrement count')
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
              <div
                key={location.id}
                className="location-item"
                onClick={() => setSelectedLocation(location)}
              >
                <div className="location-info">
                  <span className="location-name">
                    {isTopLocation && <span className="top-emoji">💩</span>}
                    {location.location_name}
                  </span>
                  <span className="location-count">Count: {location.count}</span>
                </div>
                <button
                  onClick={(e) => handleIncrement(location.id, e)}
                  className="increment-button"
                >
                  +1
                </button>
              </div>
            )
          })
        )}
      </div>

      {selectedLocation && (
        <div
          className="location-modal-overlay"
          onClick={() => setSelectedLocation(null)}
        >
          <div
            className="location-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setSelectedLocation(null)}
            >
              ×
            </button>
            <h2>{selectedLocation.location_name}</h2>
            <div className="modal-count-display">
              <span className="modal-count-number">{selectedLocation.count}</span>
              <span className="modal-count-label">Total Visits</span>
            </div>
            <div className="modal-buttons">
              <button
                onClick={() => handleDecrement(selectedLocation.id)}
                className="decrement-button"
                disabled={selectedLocation.count <= 0}
              >
                -1
              </button>
              <button
                onClick={() => handleIncrement(selectedLocation.id)}
                className="modal-increment-button"
              >
                +1
              </button>
            </div>
            <p className="modal-info">
              Created: {new Date(selectedLocation.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard

