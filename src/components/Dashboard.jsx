import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { addressesMatch } from '../utils/addressMatch'
import LocationCalendar from './LocationCalendar'
import LocationDataModal from './LocationDataModal'
import './Dashboard.css'

function Dashboard({ user, onNavigateToSettings, onNavigateToLeaderboard, onNavigateToNews, onNavigateToNotifications }) {
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
  const [editingLocationId, setEditingLocationId] = useState(null)
  const [editingLocationName, setEditingLocationName] = useState('')
  const [selectedDumpType, setSelectedDumpType] = useState('classic_dump')
  const [showSearchInput, setShowSearchInput] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDuplicateLocationModal, setShowDuplicateLocationModal] = useState(false)
  const [duplicateExistingLocation, setDuplicateExistingLocation] = useState(null) // { id, location_name }
  const [duplicateNewName, setDuplicateNewName] = useState('')
  const [duplicateIsExact, setDuplicateIsExact] = useState(false)
  const [pendingNewLocation, setPendingNewLocation] = useState(null) // { location_name, address?, latitude?, longitude?, location_data_provided?, location_data_declined? } - no DB write until dump type submitted
  const [showDuplicateAddressModal, setShowDuplicateAddressModal] = useState(false)
  const [duplicateAddressExistingName, setDuplicateAddressExistingName] = useState('')

  useEffect(() => {
    ensureUserExists()
    fetchUserLocationTrackingOptIn()
  }, [user])

  const ensureUserExists = async () => {
    try {
      // Call database function to ensure user exists (bypasses RLS)
      const { error: rpcError } = await supabase.rpc('dt_ensure_user_exists')

      if (rpcError) {
        console.error('Failed to ensure user exists:', rpcError)
        // If the function doesn't exist yet, try the fallback method
        const { data: existingUser } = await supabase
          .from('dt_users')
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
        .from('dt_locations')
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
        .from('dt_users')
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
    setError('')

    try {
      // Ensure user exists before creating dump (call RPC function)
      await supabase.rpc('dt_ensure_user_exists')

      // Fetch all location names from server so similar check is never stale
      const { data: allDumps, error: fetchError } = await supabase
        .from('dt_locations')
        .select('id, location_name')
        .eq('user_id', user.id)

      if (fetchError) throw fetchError

      const nameLower = locationName.toLowerCase()
      const similar = (allDumps || []).find((loc) => {
        const existing = (loc.location_name || '').trim()
        if (!existing) return false
        const existingLower = existing.toLowerCase()
        if (existingLower === nameLower) return false // exact handled below
        return nameLower.includes(existingLower) || existingLower.includes(nameLower)
      })
      if (similar) {
        setNewLocation(locationName) // leave text so user can edit
        setDuplicateExistingLocation({ id: similar.id, location_name: similar.location_name })
        setDuplicateNewName(locationName)
        setDuplicateIsExact(false)
        setShowDuplicateLocationModal(true)
        return
      }

      // Check if location exists (case-insensitive exact match)
      const { data: existing } = await supabase
        .from('dt_locations')
        .select('*')
        .eq('user_id', user.id)
        .ilike('location_name', locationName)
        .single()

      if (existing) {
        setNewLocation('')
        setDuplicateExistingLocation({ id: existing.id, location_name: existing.location_name })
        setDuplicateNewName(locationName)
        setDuplicateIsExact(true)
        setShowDuplicateLocationModal(true)
        return
      }

      startCreateLocationFlow(locationName)
    } catch (err) {
      setError(err.message || 'Failed to add location')
    }
  }

  const startCreateLocationFlow = (locationName) => {
    setNewLocation('')
    setPendingNewLocation({ location_name: locationName })
    setPendingDumpId(null)
    setPendingLocationName(locationName)
    if (locationTrackingOptIn) {
      setPendingLocationForData(null)
      setPendingLocationDataCallback(null)
      setShowLocationDataModal(true)
    } else {
      setShowGhostWipeModal(true)
    }
  }

  const handleLocationDataSaveForNew = (data) => {
    setPendingNewLocation((prev) => (prev ? { ...prev, ...data } : null))
    setShowLocationDataModal(false)
    setPendingLocationName(pendingNewLocation?.location_name ?? '')
    setShowGhostWipeModal(true)
  }

  const handleLocationDataCloseForNew = () => {
    setPendingNewLocation((prev) => (prev ? { ...prev, location_data_declined: true } : null))
    setShowLocationDataModal(false)
    setPendingLocationName(pendingNewLocation?.location_name ?? '')
    setShowGhostWipeModal(true)
  }

  const handleDuplicateAddressModalOk = () => {
    const name = pendingNewLocation?.location_name ?? ''
    setShowDuplicateAddressModal(false)
    setDuplicateAddressExistingName('')
    setShowGhostWipeModal(false)
    setPendingNewLocation(null)
    setPendingDumpId(null)
    setPendingLocationName('')
    setNewLocation(name)
  }

  const handleDuplicateModalAddToExisting = () => {
    if (!duplicateExistingLocation) return
    setPendingDumpId(duplicateExistingLocation.id)
    setPendingLocationName(duplicateExistingLocation.location_name)
    setShowDuplicateLocationModal(false)
    setDuplicateExistingLocation(null)
    setDuplicateNewName('')
    setShowGhostWipeModal(true)
  }

  const handleDuplicateModalCreateAnyway = () => {
    const name = duplicateNewName
    setShowDuplicateLocationModal(false)
    setDuplicateExistingLocation(null)
    setDuplicateNewName('')
    startCreateLocationFlow(name)
  }

  const handleDuplicateModalCancel = () => {
    setShowDuplicateLocationModal(false)
    setDuplicateExistingLocation(null)
    setDuplicateNewName('')
    setNewLocation(duplicateNewName) // restore so user can edit
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

  const handleDeleteLocation = async (locationId, e) => {
    e?.stopPropagation()
    const location = locations.find((loc) => loc.id === locationId)
    if (!location || location.count !== 0) return
    try {
      const { error } = await supabase
        .from('dt_locations')
        .delete()
        .eq('id', locationId)
        .eq('user_id', user.id)

      if (error) throw error

      setLocations((prev) => prev.filter((loc) => loc.id !== locationId))
      if (selectedLocation?.id === locationId) {
        setSelectedLocation(null)
        cancelEditingLocation()
      }
    } catch (err) {
      setError(err.message || 'Failed to remove location')
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
        .from('dt_entries')
        .select('id')
        .eq('location_id', locationId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (findError) {
        // Fallback to old method if dump_entries table doesn't exist yet
        const newCount = location.count - 1
        const { data, error } = await supabase
          .from('dt_locations')
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
        .from('dt_entries')
        .delete()
        .eq('id', recentEntry.id)

      if (deleteError) throw deleteError

      // Fetch updated location after entry is deleted
      const { data, error } = await supabase
        .from('dt_locations')
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
    const isNewLocationFlow = pendingNewLocation != null
    if (!pendingDumpId && !isNewLocationFlow) return

    try {
      let dumpIdToUse = pendingDumpId

      if (isNewLocationFlow) {
        const { location_name, address, latitude, longitude, location_data_provided, location_data_declined } = pendingNewLocation

        if (address && address.trim()) {
          const { data: userLocations } = await supabase
            .from('dt_locations')
            .select('id, location_name, address')
            .eq('user_id', user.id)
            .not('address', 'is', null)

          const existingWithAddress = (userLocations || []).find((row) =>
            addressesMatch(address.trim(), row.address)
          )

          if (existingWithAddress) {
            setDuplicateAddressExistingName(existingWithAddress.location_name)
            setShowDuplicateAddressModal(true)
            return
          }
        }

        const { data: newDump, error: insertDumpError } = await supabase
          .from('dt_locations')
          .insert({
            user_id: user.id,
            location_name: location_name,
            count: 0,
            address: address && address.trim() ? address.trim() : null,
            latitude: latitude ?? null,
            longitude: longitude ?? null,
            location_data_provided: location_data_provided === true,
            location_data_declined: location_data_declined === true,
          })
          .select()
          .single()

        if (insertDumpError) throw insertDumpError
        dumpIdToUse = newDump.id
      }

      const entryData = {
        location_id: dumpIdToUse,
        user_id: user.id,
        ghost_wipe: dumpType === 'ghost_wipe',
        messy_dump: dumpType === 'messy_dump',
        classic_dump: dumpType === 'classic_dump',
        liquid_dump: dumpType === 'liquid_dump',
        explosive_dump: dumpType === 'explosive_dump',
      }

      const { error } = await supabase
        .from('dt_entries')
        .insert(entryData)
        .select()
        .single()

      if (error) throw error

      const { data: updatedLocation, error: fetchError } = await supabase
        .from('dt_locations')
        .select('*')
        .eq('id', dumpIdToUse)
        .single()

      if (fetchError) {
        console.error('Error fetching updated location:', fetchError)
      } else {
        setLocations((prev) => {
          const updated = prev.map((loc) => (loc.id === dumpIdToUse ? updatedLocation : loc))
          if (!updated.find((loc) => loc.id === dumpIdToUse)) updated.push(updatedLocation)
          return updated.sort((a, b) => b.count - a.count)
        })
        if (selectedLocation?.id === dumpIdToUse) {
          setSelectedLocation(updatedLocation)
        }
      }

      setShowGhostWipeModal(false)
      setPendingDumpId(null)
      setPendingLocationName('')
      setPendingNewLocation(null)
    } catch (err) {
      console.error('Error creating dump entry:', err)
      setError(err.message || 'Failed to save dump entry')
      setShowGhostWipeModal(false)
      setPendingDumpId(null)
      setPendingLocationName('')
      setPendingNewLocation(null)
    }
  }

  const DUMP_TYPE_OPTIONS = [
    { value: 'ghost_wipe', label: '👻 Ghost Wipe' },
    { value: 'messy_dump', label: '💩 Messy Dump' },
    { value: 'liquid_dump', label: '💧 Liquid Dump' },
    { value: 'explosive_dump', label: '💣 Explosive Dump' },
    { value: 'classic_dump', label: '🚽 Classic Dump' },
    { value: 'prefer_not_to_say', label: 'Prefer Not To Say' },
  ]

  const handleSubmitDumpType = async () => {
    await createDumpEntry(selectedDumpType)
  }

  const handleCloseModal = () => {
    const name = pendingNewLocation?.location_name ?? ''
    setShowGhostWipeModal(false)
    setPendingDumpId(null)
    setPendingLocationName('')
    setPendingNewLocation(null)
    if (name) setNewLocation(name)
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

  const startEditingLocation = (location, e) => {
    if (e) e.stopPropagation()
    setEditingLocationId(location.id)
    setEditingLocationName(location.location_name)
    setError('')
  }

  const cancelEditingLocation = (e) => {
    e?.stopPropagation?.()
    setEditingLocationId(null)
    setEditingLocationName('')
    setError('')
  }

  const handleSaveLocationName = async (locationId, e) => {
    e?.stopPropagation?.()
    const newName = editingLocationName.trim()
    if (!newName) {
      cancelEditingLocation()
      return
    }

    const location = locations.find((loc) => loc.id === locationId)
    if (location?.location_name === newName) {
      cancelEditingLocation()
      return
    }

    setError('')
    try {
      const { data: existing } = await supabase
        .from('dt_locations')
        .select('id')
        .eq('user_id', user.id)
        .ilike('location_name', newName)
        .neq('id', locationId)
        .maybeSingle()

      if (existing) {
        setError(`You already have a location named "${newName}".`)
        return
      }

      const { error: updateError } = await supabase
        .from('dt_locations')
        .update({ location_name: newName })
        .eq('id', locationId)
        .eq('user_id', user.id)

      if (updateError) throw updateError

      setLocations((prev) =>
        prev.map((loc) =>
          loc.id === locationId ? { ...loc, location_name: newName } : loc
        )
      )
      if (selectedLocation?.id === locationId) {
        setSelectedLocation((prev) => (prev ? { ...prev, location_name: newName } : null))
      }
      cancelEditingLocation()
    } catch (err) {
      setError(err.message || 'Failed to update location name')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const searchQ = searchQuery.trim().toLowerCase()
  const filteredLocations = searchQ
    ? locations.filter((loc) => loc.location_name.toLowerCase().includes(searchQ))
    : locations

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
          <button onClick={onNavigateToNotifications} className="notifications-button" title="Notifications">
            🔔
          </button>
          <button onClick={onNavigateToNews} className="news-button" title="News">
            📰
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
        <div className="add-form-buttons">
          <button type="submit" className="add-button">
            ➕ Add
          </button>
          <button
            type="button"
            onClick={() => setShowSearchInput((v) => !v)}
            className="search-toggle-button"
            title="Search locations"
          >
            🔍
          </button>
        </div>
      </form>

      {showSearchInput && (
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search locations by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="location-input search-input"
            autoFocus
          />
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setShowSearchInput(false); }}
            className="search-close-button"
            title="Close search"
          >
            ✕
          </button>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <div className="locations-list">
        {locations.length === 0 ? (
          <div className="empty-state">
            <p>No locations yet. Add your first location above!</p>
          </div>
        ) : filteredLocations.length === 0 ? (
          <div className="empty-state">
            <p>No locations match your search.</p>
          </div>
        ) : (
          filteredLocations.map((location) => {
            const isTopLocation = locations.length > 0 && location.id === locations[0].id
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
                <div className="location-item-actions">
                  {location.count === 0 && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteLocation(location.id, e)}
                      className="delete-location-button"
                      title="Remove location"
                    >
                      Remove
                    </button>
                  )}
                  <button
                    onClick={(e) => handleIncrement(location.id, e)}
                    className="increment-button"
                  >
                    +1
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {selectedLocation && (
        <LocationCalendar
          location={selectedLocation}
          user={user}
          onClose={() => {
            cancelEditingLocation()
            setSelectedLocation(null)
          }}
          isEditingName={editingLocationId === selectedLocation.id}
          editingLocationName={editingLocationName}
          setEditingLocationName={setEditingLocationName}
          onStartEditName={() => startEditingLocation(selectedLocation)}
          onSaveLocationName={(e) => handleSaveLocationName(selectedLocation.id, e)}
          onCancelEditName={cancelEditingLocation}
        />
      )}

      {showLocationDataModal && (pendingLocationForData || pendingNewLocation) && (
        <LocationDataModal
          location={pendingLocationForData ?? { location_name: pendingNewLocation?.location_name ?? '', id: null }}
          userId={user.id}
          onClose={pendingLocationForData ? handleLocationDataClose : handleLocationDataCloseForNew}
          onSave={pendingLocationForData ? handleLocationDataSave : handleLocationDataSaveForNew}
        />
      )}

      {showDuplicateLocationModal && duplicateExistingLocation && (
        <div
          className="duplicate-location-modal-overlay"
          onClick={handleDuplicateModalCancel}
        >
          <div
            className="duplicate-location-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={handleDuplicateModalCancel}
              aria-label="Close"
            >
              ×
            </button>
            <h2>Location Already Exists</h2>
            <p>
              {duplicateIsExact
                ? 'You already have this location:'
                : 'You already have a similar location:'}
              <br />
              <strong>{duplicateExistingLocation.location_name}</strong>
            </p>
            <div className="duplicate-location-modal-actions">
              <button
                type="button"
                onClick={handleDuplicateModalAddToExisting}
                className="duplicate-modal-btn duplicate-modal-btn-primary"
              >
                Add dump to {duplicateExistingLocation.location_name}
              </button>
              {duplicateIsExact ? (
                <button
                  type="button"
                  onClick={handleDuplicateModalCancel}
                  className="duplicate-modal-btn duplicate-modal-btn-secondary"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDuplicateModalCreateAnyway}
                  className="duplicate-modal-btn duplicate-modal-btn-secondary"
                >
                  Create &quot;{duplicateNewName}&quot; as new location
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showDuplicateAddressModal && (
        <div
          className="duplicate-location-modal-overlay"
          onClick={handleDuplicateAddressModalOk}
        >
          <div
            className="duplicate-location-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Address already in use</h2>
            <p>
              This address is already used for:
              <br />
              <strong>{duplicateAddressExistingName}</strong>
              <br />
              Use that location or choose a different address.
            </p>
            <div className="duplicate-location-modal-actions">
              <button
                type="button"
                onClick={handleDuplicateAddressModalOk}
                className="duplicate-modal-btn duplicate-modal-btn-primary"
              >
                OK
              </button>
            </div>
          </div>
        </div>
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
            <div className="dump-type-dropdown-section">
              <select
                id="dump-type-select"
                aria-label="Dump type"
                value={selectedDumpType}
                onChange={(e) => setSelectedDumpType(e.target.value)}
                className="dump-type-select"
              >
                {DUMP_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSubmitDumpType}
                className="dump-type-submit-button"
              >
                Add dump
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard

