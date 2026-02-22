import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import LocationDataModal from './LocationDataModal'
import './LocationCalendar.css'

function LocationCalendar({
  location,
  user,
  onClose,
  isEditingName = false,
  editingLocationName = '',
  setEditingLocationName,
  onStartEditName,
  onSaveLocationName,
  onCancelEditName,
}) {
  const [dumpEntries, setDumpEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [entriesByDate, setEntriesByDate] = useState({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [entryToEdit, setEntryToEdit] = useState(null)
  const [updateError, setUpdateError] = useState('')
  const [showAddEntryModal, setShowAddEntryModal] = useState(false)
  const [selectedDateForEntry, setSelectedDateForEntry] = useState(null)
  const [selectedTime, setSelectedTime] = useState('')
  const [addEntryError, setAddEntryError] = useState('')
  const [addEntryLoading, setAddEntryLoading] = useState(false)
  const [showLocationDataModal, setShowLocationDataModal] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(location)

  useEffect(() => {
    if (location) {
      setCurrentLocation(location)
      fetchDumpEntries()
    }
  }, [location?.id, location?.count, location])

  useEffect(() => {
    // Group entries by date (EST)
    const grouped = {}
    dumpEntries.forEach(entry => {
      // Convert to EST date string
      const estDateStr = new Date(entry.created_at).toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      // Format: MM/DD/YYYY
      const dateKey = estDateStr
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(entry)
    })
    setEntriesByDate(grouped)
  }, [dumpEntries])

  const fetchDumpEntries = async () => {
    if (!location) return
    
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('dump_entries')
        .select('*')
        .eq('dump_id', location.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDumpEntries(data || [])
    } catch (err) {
      console.error('Error fetching dump entries:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatToEST = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    return { daysInMonth, startingDayOfWeek, year, month }
  }

  const getDateKey = (year, month, day) => {
    const monthStr = String(month + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    return `${monthStr}/${dayStr}/${year}`
  }

  const handleDateClick = (year, month, day) => {
    const dateKey = getDateKey(year, month, day)
    const hasEntries = entriesByDate[dateKey] && entriesByDate[dateKey].length > 0
    
    if (hasEntries) {
      // Show existing entries
      setSelectedDate({ year, month, day, dateKey })
    } else {
      // Show modal to add new entry for this date
      setSelectedDateForEntry({ year, month, day, dateKey })
      setShowAddEntryModal(true)
      setSelectedTime('')
      setAddEntryError('')
    }
  }

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handleDeleteEntry = (entry) => {
    setEntryToDelete(entry)
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = async () => {
    if (!entryToDelete) return

    try {
      // Delete the entry directly
      const { error } = await supabase
        .from('dump_entries')
        .delete()
        .eq('id', entryToDelete.id)
        .eq('user_id', user.id)

      if (error) throw error

      // Refresh entries after deletion
      await fetchDumpEntries()

      // Fetch updated location to get new count
      const { data: updatedLocation, error: locationError } = await supabase
        .from('dumps')
        .select('*')
        .eq('id', location.id)
        .single()

      if (!locationError && updatedLocation) {
        setCurrentLocation(updatedLocation)
      }

      // Close modal and reset state
      setShowDeleteConfirm(false)
      setEntryToDelete(null)
      
      // If the deleted entry was the last one for this date, clear selected date
      const deletedEntryDateKey = new Date(entryToDelete.created_at).toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      
      // Check if there are any remaining entries for this date after deletion
      const remainingEntries = dumpEntries.filter(e => {
        if (e.id === entryToDelete.id) return false
        const entryDateKey = new Date(e.created_at).toLocaleDateString('en-US', {
          timeZone: 'America/New_York',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        })
        return entryDateKey === deletedEntryDateKey
      })
      
      // If no remaining entries for this date and it's currently selected, clear selection
      if (remainingEntries.length === 0 && selectedDate?.dateKey === deletedEntryDateKey) {
        setSelectedDate(null)
      }
    } catch (err) {
      console.error('Error deleting entry:', err)
      setShowDeleteConfirm(false)
      setEntryToDelete(null)
    }
  }

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false)
    setEntryToDelete(null)
  }

  const formatDateToEST = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleEditEntry = (entry) => {
    setEntryToEdit(entry)
    setShowEditModal(true)
  }

  const handleUpdateEntry = async (dumpType) => {
    if (!entryToEdit) return

    try {
      setUpdateError('')
      const updateData = {
        ghost_wipe: dumpType === 'ghost_wipe',
        messy_dump: dumpType === 'messy_dump',
        classic_dump: dumpType === 'classic_dump',
        liquid_dump: dumpType === 'liquid_dump',
      }

      // If standard, set all to false
      if (dumpType === 'standard') {
        updateData.ghost_wipe = false
        updateData.messy_dump = false
        updateData.classic_dump = false
        updateData.liquid_dump = false
      }

      const { error } = await supabase
        .from('dump_entries')
        .update(updateData)
        .eq('id', entryToEdit.id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error updating entry:', error)
        setUpdateError(error.message || 'Failed to update dump entry')
        return
      }

      // Refresh entries after update
      await fetchDumpEntries()

      // Close modal and reset state
      setShowEditModal(false)
      setEntryToEdit(null)
      setUpdateError('')
    } catch (err) {
      console.error('Error updating entry:', err)
      setUpdateError(err.message || 'Failed to update dump entry')
    }
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setEntryToEdit(null)
  }

  const handleAddEntryForDate = async (dumpType) => {
    if (!selectedDateForEntry || !selectedTime) {
      setAddEntryError('Please select a time')
      return
    }

    setAddEntryLoading(true)
    setAddEntryError('')

    try {
      // Create a date object in EST timezone with the selected date and time
      const { year, month, day } = selectedDateForEntry
      const [hours, minutes] = selectedTime.split(':').map(Number)
      
      // Format as ISO string with EST timezone offset (-05:00 for EST, -04:00 for EDT)
      // For simplicity, we'll use -05:00 (EST). PostgreSQL will store it correctly.
      // Note: This assumes EST. For EDT, it would be -04:00, but EST is more common.
      const isoString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00-05:00`

      // Create the dump entry with custom created_at timestamp
      const entryData = {
        dump_id: location.id,
        user_id: user.id,
        ghost_wipe: dumpType === 'ghost_wipe',
        messy_dump: dumpType === 'messy_dump',
        classic_dump: dumpType === 'classic_dump',
        liquid_dump: dumpType === 'liquid_dump',
        created_at: isoString,
      }

      const { error } = await supabase
        .from('dump_entries')
        .insert(entryData)

      if (error) throw error

      // Refresh entries after adding
      await fetchDumpEntries()

      // Close modal and reset state
      setShowAddEntryModal(false)
      setSelectedDateForEntry(null)
      setSelectedTime('')
      setAddEntryError('')

      // Show the date details with the new entry
      setSelectedDate(selectedDateForEntry)
    } catch (err) {
      console.error('Error adding entry:', err)
      setAddEntryError(err.message || 'Failed to add dump entry')
    } finally {
      setAddEntryLoading(false)
    }
  }

  const handleCloseAddEntryModal = () => {
    setShowAddEntryModal(false)
    setSelectedDateForEntry(null)
    setSelectedTime('')
    setAddEntryError('')
  }

  const handleLocationDataSave = async (updatedLocation) => {
    console.log('[LocationCalendar] Location data saved:', updatedLocation)
    
    // Fetch the latest location data to ensure we have all fields
    try {
      const { data: freshLocation, error } = await supabase
        .from('dumps')
        .select('*')
        .eq('id', updatedLocation.id)
        .single()

      if (error) {
        console.error('[LocationCalendar] Error fetching updated location:', error)
        // Still use the updated location from the modal
        setCurrentLocation(updatedLocation)
      } else {
        console.log('[LocationCalendar] Updated location fetched:', freshLocation)
        setCurrentLocation(freshLocation)
      }
    } catch (err) {
      console.error('[LocationCalendar] Error in handleLocationDataSave:', err)
      setCurrentLocation(updatedLocation)
    }
    
    setShowLocationDataModal(false)
  }

  const handleLocationDataClose = () => {
    setShowLocationDataModal(false)
  }

  // Check if location data button should be shown
  const shouldShowLocationDataButton = currentLocation && 
    (!currentLocation.location_data_provided || currentLocation.location_data_declined)

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth)
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const selectedDateEntries = selectedDate ? entriesByDate[selectedDate.dateKey] || [] : []

  return (
    <div className="location-calendar-overlay" onClick={onClose}>
      <div className="location-calendar-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        
        <div className="location-calendar-header">
          {isEditingName ? (
            <div className="location-calendar-edit-form" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={editingLocationName}
                onChange={(e) => setEditingLocationName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveLocationName(e)
                  if (e.key === 'Escape') onCancelEditName(e)
                }}
                className="location-edit-input"
                placeholder="Location name"
                autoFocus
              />
              <button
                type="button"
                onClick={onSaveLocationName}
                className="location-edit-save"
                title="Save"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={onCancelEditName}
                className="location-edit-cancel"
                title="Cancel"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="location-calendar-title-row">
              <h2>{currentLocation?.location_name || location.location_name}</h2>
              <button
                type="button"
                onClick={onStartEditName}
                className="location-edit-button"
                title="Edit location name"
              >
                ✏️
              </button>
            </div>
          )}
          {!isEditingName && shouldShowLocationDataButton && (
            <button
              onClick={() => setShowLocationDataModal(true)}
              className="add-location-data-button"
              title="Add location data (address or GPS coordinates)"
            >
              <span>📍</span>
              <span>Add Location Data</span>
            </button>
          )}
        </div>
        <div className="calendar-total">
          <span className="calendar-total-number">{currentLocation?.count || location.count}</span>
          <span className="calendar-total-label">Total Visits</span>
        </div>

        {loading ? (
          <div className="calendar-loading">Loading calendar...</div>
        ) : (
          <>
            <div className="calendar-container">
              <div className="calendar-header">
                <button className="calendar-nav-button" onClick={handlePreviousMonth}>‹</button>
                <h3 className="calendar-month">{monthName}</h3>
                <button className="calendar-nav-button" onClick={handleNextMonth}>›</button>
              </div>
              
              <div className="calendar-weekdays">
                <div className="calendar-weekday">Sun</div>
                <div className="calendar-weekday">Mon</div>
                <div className="calendar-weekday">Tue</div>
                <div className="calendar-weekday">Wed</div>
                <div className="calendar-weekday">Thu</div>
                <div className="calendar-weekday">Fri</div>
                <div className="calendar-weekday">Sat</div>
              </div>

              <div className="calendar-days">
                {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="calendar-day empty"></div>
                ))}
                
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dateKey = getDateKey(year, month, day)
                  const count = entriesByDate[dateKey]?.length || 0
                  const hasEntries = count > 0
                  
                  return (
                    <div
                      key={day}
                      className={`calendar-day ${hasEntries ? 'has-entries' : ''}`}
                      onClick={() => handleDateClick(year, month, day)}
                    >
                      <span className="calendar-day-number">{day}</span>
                      {hasEntries && (
                        <span className="calendar-day-count">{count}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {selectedDate && selectedDateEntries.length > 0 && (
              <div className="date-details">
                <div className="date-details-header">
                  <h4>
                    {new Date(selectedDate.year, selectedDate.month, selectedDate.day).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </h4>
                  <button
                    onClick={() => {
                      setSelectedDateForEntry(selectedDate)
                      setShowAddEntryModal(true)
                      setSelectedTime('')
                      setAddEntryError('')
                    }}
                    className="add-entry-button"
                    title="Add another dump for this date"
                  >
                    + Add Entry
                  </button>
                </div>
                <div className="date-entries-list">
                  {selectedDateEntries
                    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                    .map((entry) => (
                      <div key={entry.id} className="date-entry-item">
                        <div className="date-entry-info">
                          <div className="date-entry-time">
                            {formatToEST(entry.created_at)} EST
                          </div>
                          <div className="date-entry-badges">
                            {entry.ghost_wipe && (
                              <span className="entry-badge ghost-wipe-badge">👻 Ghost Wipe</span>
                            )}
                            {entry.messy_dump && (
                              <span className="entry-badge messy-dump-badge">💩 Messy Dump</span>
                            )}
                            {entry.classic_dump && !entry.ghost_wipe && !entry.messy_dump && (
                              <span className="entry-badge classic-dump-badge">🚽 Classic Dump</span>
                            )}
                            {entry.liquid_dump && (
                              <span className="entry-badge liquid-dump-badge">💧 Liquid Dump</span>
                            )}
                            {!entry.ghost_wipe && !entry.messy_dump && !entry.classic_dump && !entry.liquid_dump && (
                              <span className="entry-badge">Standard</span>
                            )}
                          </div>
                        </div>
                        <div className="date-entry-actions">
                          <button
                            onClick={() => handleEditEntry(entry)}
                            className="edit-entry-button"
                            title="Edit dump type"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteEntry(entry)}
                            className="delete-entry-button"
                            title="Delete this dump entry"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showDeleteConfirm && entryToDelete && (
        <div className="delete-confirm-overlay" onClick={handleCancelDelete}>
          <div className="delete-confirm-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleCancelDelete}>×</button>
            <h3>Are you sure you want to delete this dump entry?</h3>
            
            <div className="delete-entry-details">
              <div className="delete-entry-info">
                <div className="delete-entry-date">
                  <strong>Date:</strong> {formatDateToEST(entryToDelete.created_at)}
                </div>
                <div className="delete-entry-time">
                  <strong>Time:</strong> {formatToEST(entryToDelete.created_at)} EST
                </div>
                <div className="delete-entry-badges">
                  <strong>Type:</strong>
                  <div className="delete-badges-list">
                    {entryToDelete.ghost_wipe && (
                      <span className="entry-badge ghost-wipe-badge">👻 Ghost Wipe</span>
                    )}
                    {entryToDelete.messy_dump && (
                      <span className="entry-badge messy-dump-badge">💩 Messy Dump</span>
                    )}
                    {entryToDelete.classic_dump && !entryToDelete.ghost_wipe && !entryToDelete.messy_dump && (
                      <span className="entry-badge classic-dump-badge">🚽 Classic Dump</span>
                    )}
                    {entryToDelete.liquid_dump && (
                      <span className="entry-badge liquid-dump-badge">💧 Liquid Dump</span>
                    )}
                    {!entryToDelete.ghost_wipe && !entryToDelete.messy_dump && !entryToDelete.classic_dump && !entryToDelete.liquid_dump && (
                      <span className="entry-badge">Standard</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="delete-confirm-buttons">
              <button
                onClick={handleCancelDelete}
                className="cancel-delete-button"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="confirm-delete-button"
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && entryToEdit && (
        <div className="edit-entry-overlay" onClick={handleCloseEditModal}>
          <div className="edit-entry-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleCloseEditModal}>×</button>
            <div className="wipe-type-icon">✏️</div>
            <h2>Edit Dump Type</h2>
            <p>Change the type for this dump entry</p>
            <div className="edit-entry-info">
              <div className="edit-entry-time">
                <strong>Time:</strong> {formatToEST(entryToEdit.created_at)} EST
              </div>
              <div className="edit-entry-date">
                <strong>Date:</strong> {formatDateToEST(entryToEdit.created_at)}
              </div>
            </div>
            {updateError && (
              <div className="error-message" style={{ marginBottom: '15px', padding: '10px', background: '#fee', color: '#c33', borderRadius: '6px', fontSize: '14px' }}>
                {updateError}
              </div>
            )}
            <div className="ghost-wipe-buttons">
              <button
                onClick={() => handleUpdateEntry('ghost_wipe')}
                className={`ghost-wipe-button ${entryToEdit.ghost_wipe ? 'selected' : ''}`}
                title="A clean wipe with no residue - the perfect dump!"
              >
                👻🧻 Ghost Wipe
              </button>
              <button
                onClick={() => handleUpdateEntry('messy_dump')}
                className={`messy-dump-button ${entryToEdit.messy_dump ? 'selected' : ''}`}
                title="A messy dump that required extra cleanup"
              >
                💩🧻 Messy Dump
              </button>
              <button
                onClick={() => handleUpdateEntry('liquid_dump')}
                className={`liquid-dump-button ${entryToEdit.liquid_dump ? 'selected' : ''}`}
                title="A liquid dump - when things get a bit runny"
              >
                💧 Liquid Dump
              </button>
              <button
                onClick={() => handleUpdateEntry('classic_dump')}
                className={`classic-dump-button ${entryToEdit.classic_dump ? 'selected' : ''}`}
                title="A classic, standard dump - nothing special, nothing terrible"
              >
                🚽 Classic Old Dump
              </button>
              <button
                onClick={() => handleUpdateEntry('standard')}
                className={`skip-button ${!entryToEdit.ghost_wipe && !entryToEdit.messy_dump && !entryToEdit.classic_dump && !entryToEdit.liquid_dump ? 'selected' : ''}`}
                title="Standard dump type"
              >
                Standard
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddEntryModal && selectedDateForEntry && (
        <div className="edit-entry-overlay" onClick={handleCloseAddEntryModal}>
          <div className="edit-entry-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleCloseAddEntryModal}>×</button>
            <div className="wipe-type-icon">➕</div>
            <h2>Add Dump Entry</h2>
            <p>
              {new Date(selectedDateForEntry.year, selectedDateForEntry.month, selectedDateForEntry.day).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
            <div className="add-entry-time-section">
              <label htmlFor="entry-time" className="time-label">
                <strong>Time (Required):</strong>
              </label>
              <input
                id="entry-time"
                type="time"
                value={selectedTime}
                onChange={(e) => {
                  setSelectedTime(e.target.value)
                  setAddEntryError('')
                }}
                className="time-input"
                required
              />
            </div>
            {addEntryError && (
              <div className="error-message" style={{ marginBottom: '15px', padding: '10px', background: '#fee', color: '#c33', borderRadius: '6px', fontSize: '14px' }}>
                {addEntryError}
              </div>
            )}
            <div className="ghost-wipe-buttons">
              <button
                onClick={() => handleAddEntryForDate('ghost_wipe')}
                className="ghost-wipe-button"
                disabled={addEntryLoading || !selectedTime}
                title="A clean wipe with no residue - the perfect dump!"
              >
                👻🧻 Ghost Wipe
              </button>
              <button
                onClick={() => handleAddEntryForDate('messy_dump')}
                className="messy-dump-button"
                disabled={addEntryLoading || !selectedTime}
                title="A messy dump that required extra cleanup"
              >
                💩🧻 Messy Dump
              </button>
              <button
                onClick={() => handleAddEntryForDate('liquid_dump')}
                className="liquid-dump-button"
                disabled={addEntryLoading || !selectedTime}
                title="A liquid dump - when things get a bit runny"
              >
                💧 Liquid Dump
              </button>
              <button
                onClick={() => handleAddEntryForDate('classic_dump')}
                className="classic-dump-button"
                disabled={addEntryLoading || !selectedTime}
                title="A classic, standard dump - nothing special, nothing terrible"
              >
                🚽 Classic Old Dump
              </button>
              <button
                onClick={() => handleAddEntryForDate('standard')}
                className="skip-button"
                disabled={addEntryLoading || !selectedTime}
                title="Standard dump type"
              >
                Standard
              </button>
            </div>
            {addEntryLoading && (
              <div style={{ textAlign: 'center', marginTop: '15px', color: '#666' }}>
                Adding entry...
              </div>
            )}
          </div>
        </div>
      )}

      {showLocationDataModal && currentLocation && (
        <LocationDataModal
          location={currentLocation}
          onClose={handleLocationDataClose}
          onSave={handleLocationDataSave}
        />
      )}
    </div>
  )
}

export default LocationCalendar

