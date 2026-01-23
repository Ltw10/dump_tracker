import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import LocationCalendar from './LocationCalendar'
import LocationDataModal from './LocationDataModal'
import './Dashboard.css'

function Dashboard({ user, onNavigateToSettings, onNavigateToLeaderboard }) {
  const [locations, setLocations] = useState([])
  const [newLocation, setNewLocation] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [showGhostWipeModal, setShowGhostWipeModal] = useState(false)
  const [pendingDumpId, setPendingDumpId] = useState(null)
  const [pendingLocationName, setPendingLocationName] = useState('')
  const [locationTrackingOptIn, setLocationTrackingOptIn] = useState(false)
  const [showLocationDataModal, setShowLocationDataModal] = useState(false)
  const [pendingLocationForData, setPendingLocationForData] = useState(null)
  const [pendingLocationDataCallback, setPendingLocationDataCallback] = useState(null)

  useEffect(() => {
    ensureUserExists()
    fetchUserLocationTrackingOptIn()
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

  const fetchUserLocationTrackingOptIn = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('location_tracking_opt_in')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching location tracking opt-in:', error)
        return
      }

      setLocationTrackingOptIn(data?.location_tracking_opt_in === true)
    } catch (err) {
      console.error('Error fetching location tracking opt-in:', err)
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
        // Show modal first - don't create entry yet
        setPendingDumpId(existing.id)
        setPendingLocationName(locationName)
        setShowGhostWipeModal(true)
      } else {
        // Create new location (but don't create entry yet)
        const { data: newDump, error } = await supabase
          .from('dumps')
          .insert({
            user_id: user.id,
            location_name: locationName,
            count: 0, // Start with 0, will be updated when entry is created
          })
          .select()
          .single()

        if (error) throw error

        // If location tracking is enabled, show location data modal first
        if (locationTrackingOptIn) {
          setPendingLocationForData(newDump)
          setPendingLocationDataCallback(() => (updatedLocation) => {
            // After location data is saved (or skipped), show dump type modal
            setLocations((prev) => {
              const updated = prev.map((loc) => loc.id === updatedLocation.id ? updatedLocation : loc)
              if (!updated.find(loc => loc.id === updatedLocation.id)) {
                updated.push(updatedLocation)
              }
              return updated.sort((a, b) => b.count - a.count)
            })
            setPendingDumpId(updatedLocation.id)
            setPendingLocationName(updatedLocation.location_name)
            setShowGhostWipeModal(true)
          })
          setShowLocationDataModal(true)
        } else {
          // Show modal - entry will be created when user selects an option
          setPendingDumpId(newDump.id)
          setPendingLocationName(locationName)
          setShowGhostWipeModal(true)

          setLocations((prev) => {
            const updated = [newDump, ...prev]
            return updated.sort((a, b) => b.count - a.count)
          })
        }
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

      // Check if location tracking is enabled and location needs data
      if (locationTrackingOptIn && 
          !location.location_data_provided && 
          !location.location_data_declined) {
        // Show location data modal first
        setPendingLocationForData(location)
        setPendingLocationDataCallback(() => (updatedLocation) => {
          // After location data is saved (or skipped), show dump type modal
          setLocations((prev) => {
            const updated = prev.map((loc) => loc.id === updatedLocation.id ? updatedLocation : loc)
            return updated.sort((a, b) => b.count - a.count)
          })
          setPendingDumpId(updatedLocation.id)
          setPendingLocationName(updatedLocation.location_name)
          setShowGhostWipeModal(true)
        })
        setShowLocationDataModal(true)
      } else {
        // Show modal first - don't create entry yet
        setPendingDumpId(locationId)
        setPendingLocationName(location.location_name)
        setShowGhostWipeModal(true)
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

  const createDumpEntry = async (dumpType) => {
    if (!pendingDumpId) return

    try {
      // Create the dump entry with the selected type
      const entryData = {
        dump_id: pendingDumpId,
        user_id: user.id,
        ghost_wipe: dumpType === 'ghost_wipe',
        messy_dump: dumpType === 'messy_dump',
        classic_dump: dumpType === 'classic_dump',
        liquid_dump: dumpType === 'liquid_dump',
      }

      const { data: newEntry, error } = await supabase
        .from('dump_entries')
        .insert(entryData)
        .select()
        .single()

      if (error) throw error

      // Fetch updated location after entry is created (trigger will update count)
      const { data: updatedLocation, error: fetchError } = await supabase
        .from('dumps')
        .select('*')
        .eq('id', pendingDumpId)
        .single()

      if (fetchError) {
        console.error('Error fetching updated location:', fetchError)
      } else {
        // Update locations list
        setLocations((prev) => {
          const updated = prev.map((loc) => (loc.id === pendingDumpId ? updatedLocation : loc))
          return updated.sort((a, b) => b.count - a.count)
        })

        // Update selected location if it's the one being modified
        if (selectedLocation?.id === pendingDumpId) {
          setSelectedLocation(updatedLocation)
        }
      }

      // Close modal and reset state
      setShowGhostWipeModal(false)
      setPendingDumpId(null)
      setPendingLocationName('')
    } catch (err) {
      console.error('Error creating dump entry:', err)
      setError(err.message || 'Failed to save dump entry')
      setShowGhostWipeModal(false)
      setPendingDumpId(null)
      setPendingLocationName('')
    }
  }

  const handleGhostWipe = async () => {
    await createDumpEntry('ghost_wipe')
  }

  const handleMessyDump = async () => {
    await createDumpEntry('messy_dump')
  }

  const handleClassicDump = async () => {
    await createDumpEntry('classic_dump')
  }

  const handleLiquidDump = async () => {
    await createDumpEntry('liquid_dump')
  }

  const handlePreferNotToSay = async () => {
    await createDumpEntry('prefer_not_to_say')
  }

  const handleCloseModal = () => {
    // Just close the modal without creating any entry
    setShowGhostWipeModal(false)
    setPendingDumpId(null)
    setPendingLocationName('')
  }

  const handleLocationDataSave = (updatedLocation) => {
    // Update locations list
    setLocations((prev) => {
      const updated = prev.map((loc) => loc.id === updatedLocation.id ? updatedLocation : loc)
      if (!updated.find(loc => loc.id === updatedLocation.id)) {
        updated.push(updatedLocation)
      }
      return updated.sort((a, b) => b.count - a.count)
    })

    // Update selected location if it's the one being modified
    if (selectedLocation?.id === updatedLocation.id) {
      setSelectedLocation(updatedLocation)
    }

    // Call the callback if one was set
    if (pendingLocationDataCallback) {
      pendingLocationDataCallback(updatedLocation)
      setPendingLocationDataCallback(null)
    }

    setShowLocationDataModal(false)
    setPendingLocationForData(null)
  }

  const handleLocationDataClose = () => {
    // If there's a callback, we still need to proceed (user skipped)
    if (pendingLocationDataCallback && pendingLocationForData) {
      // User closed without saving, but we should still proceed to dump type modal
      const location = pendingLocationForData
      setPendingDumpId(location.id)
      setPendingLocationName(location.location_name)
      setShowGhostWipeModal(true)
    }
    setShowLocationDataModal(false)
    setPendingLocationForData(null)
    setPendingLocationDataCallback(null)
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
        <div className="header-actions">
          <button onClick={onNavigateToLeaderboard} className="leaderboard-button" title="Leaderboard">
            🏆
          </button>
          <button onClick={onNavigateToSettings} className="settings-button" title="Settings">
            ⚙️
          </button>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
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
        <LocationCalendar
          location={selectedLocation}
          user={user}
          onClose={() => setSelectedLocation(null)}
        />
      )}

      {showLocationDataModal && pendingLocationForData && (
        <LocationDataModal
          location={pendingLocationForData}
          onClose={handleLocationDataClose}
          onSave={handleLocationDataSave}
        />
      )}

      {showGhostWipeModal && (
        <div
          className="ghost-wipe-modal-overlay"
          onClick={handleCloseModal}
        >
          <div
            className="ghost-wipe-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={handleCloseModal}
            >
              ×
            </button>
            <div className="wipe-type-icon">🚽</div>
            <h2>What type of dump?</h2>
            <p>How did this dump go?</p>
            <div className="ghost-wipe-buttons">
              <button
                onClick={handleGhostWipe}
                className="ghost-wipe-button"
                title="A clean wipe with no residue - the perfect dump!"
              >
                👻🧻 Ghost Wipe
              </button>
              <button
                onClick={handleMessyDump}
                className="messy-dump-button"
                title="A messy dump that required extra cleanup"
              >
                💩🧻 Messy Dump
              </button>
              <button
                onClick={handleLiquidDump}
                className="liquid-dump-button"
                title="A liquid dump - when things get a bit runny"
              >
                💧 Liquid Dump
              </button>
              <button
                onClick={handleClassicDump}
                className="classic-dump-button"
                title="A classic, standard dump - nothing special, nothing terrible"
              >
                🚽 Classic Old Dump
              </button>
              <button
                onClick={handlePreferNotToSay}
                className="skip-button"
                title="Don't want to specify the type of dump"
              >
                Prefer Not To Say
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard

