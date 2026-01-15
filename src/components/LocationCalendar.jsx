import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import './LocationCalendar.css'

function LocationCalendar({ location, user, onClose, onIncrement, onDecrement }) {
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

  useEffect(() => {
    if (location) {
      fetchDumpEntries()
    }
  }, [location?.id, location?.count])

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
    if (entriesByDate[dateKey] && entriesByDate[dateKey].length > 0) {
      setSelectedDate({ year, month, day, dateKey })
    }
  }

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handleDecrementClick = async () => {
    if (!location || location.count <= 0) return

    try {
      // Find the most recent dump entry
      const mostRecentEntry = dumpEntries.length > 0 ? dumpEntries[0] : null
      
      if (!mostRecentEntry) {
        // Fallback: fetch it from the database
        const { data, error } = await supabase
          .from('dump_entries')
          .select('*')
          .eq('dump_id', location.id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (error) throw error
        if (data) {
          setEntryToDelete(data)
          setShowDeleteConfirm(true)
        }
      } else {
        setEntryToDelete(mostRecentEntry)
        setShowDeleteConfirm(true)
      }
    } catch (err) {
      console.error('Error fetching most recent entry:', err)
    }
  }

  const handleConfirmDelete = async () => {
    if (!entryToDelete) return

    try {
      // Call the parent's decrement handler which will handle the deletion
      await onDecrement(location.id)
      
      // Refresh entries after deletion
      await fetchDumpEntries()
      
      // Close modal and reset state
      setShowDeleteConfirm(false)
      setEntryToDelete(null)
      setSelectedDate(null) // Clear selected date if it was showing the deleted entry
    } catch (err) {
      console.error('Error deleting entry:', err)
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
      }

      // If standard, set all to false
      if (dumpType === 'standard') {
        updateData.ghost_wipe = false
        updateData.messy_dump = false
        updateData.classic_dump = false
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

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth)
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const selectedDateEntries = selectedDate ? entriesByDate[selectedDate.dateKey] || [] : []

  return (
    <div className="location-calendar-overlay" onClick={onClose}>
      <div className="location-calendar-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        
        <h2>{location.location_name}</h2>
        <div className="calendar-total">
          <span className="calendar-total-number">{location.count}</span>
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
                <h4>
                  {new Date(selectedDate.year, selectedDate.month, selectedDate.day).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h4>
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
                            {!entry.ghost_wipe && !entry.messy_dump && !entry.classic_dump && (
                              <span className="entry-badge">Standard</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleEditEntry(entry)}
                          className="edit-entry-button"
                          title="Edit dump type"
                        >
                          ✏️
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="calendar-actions">
              <button
                onClick={handleDecrementClick}
                className="decrement-button"
                disabled={location.count <= 0}
              >
                -1
              </button>
              <button
                onClick={() => onIncrement(location.id)}
                className="modal-increment-button"
              >
                +1
              </button>
            </div>
          </>
        )}
      </div>

      {showDeleteConfirm && entryToDelete && (
        <div className="delete-confirm-overlay" onClick={handleCancelDelete}>
          <div className="delete-confirm-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleCancelDelete}>×</button>
            <h3>Are you sure you want to remove your most recent dump entry?</h3>
            
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
                    {!entryToDelete.ghost_wipe && !entryToDelete.messy_dump && !entryToDelete.classic_dump && (
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
                onClick={() => handleUpdateEntry('classic_dump')}
                className={`classic-dump-button ${entryToEdit.classic_dump ? 'selected' : ''}`}
                title="A classic, standard dump - nothing special, nothing terrible"
              >
                🚽 Classic Old Dump
              </button>
              <button
                onClick={() => handleUpdateEntry('standard')}
                className={`skip-button ${!entryToEdit.ghost_wipe && !entryToEdit.messy_dump && !entryToEdit.classic_dump ? 'selected' : ''}`}
                title="Standard dump type"
              >
                Standard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LocationCalendar

