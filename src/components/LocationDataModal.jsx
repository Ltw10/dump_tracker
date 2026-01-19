import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import './LocationDataModal.css'

function LocationDataModal({ location, onClose, onSave }) {
  const [address, setAddress] = useState(location?.address || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [useGPS, setUseGPS] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)

  useEffect(() => {
    console.log('[LocationDataModal] Component mounted/updated:', {
      locationId: location?.id,
      locationName: location?.location_name,
      existingAddress: location?.address,
      hasGeolocation: typeof navigator !== 'undefined' && !!navigator.geolocation,
      isSecureContext: window.isSecureContext,
      protocol: window.location.protocol,
      hostname: window.location.hostname
    })
  }, [location])

  const handleUseCurrentLocation = async () => {
    console.log('[LocationDataModal] handleUseCurrentLocation called')
    
    if (!navigator.geolocation) {
      const errorMsg = 'Geolocation is not supported by your browser'
      console.error('[LocationDataModal]', errorMsg)
      setError(errorMsg)
      return
    }

    console.log('[LocationDataModal] navigator.geolocation is available')
    setGpsLoading(true)
    setError('')
    console.log('[LocationDataModal] Requesting geolocation with options:', {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    })

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        console.log('[LocationDataModal] Geolocation success:', {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp
        })

        try {
          const { latitude, longitude } = position.coords
          const coordsString = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          
          console.log('[LocationDataModal] Attempting reverse geocoding for:', coordsString)
          
          // Reverse geocode to get address
          // Using a free geocoding service (Nominatim from OpenStreetMap)
          const geocodeUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          console.log('[LocationDataModal] Fetching from:', geocodeUrl)
          
          const fetchStartTime = Date.now()
          const response = await fetch(geocodeUrl, {
            headers: {
              'User-Agent': 'DumpTracker/1.0 (https://github.com/yourusername/dump_tracker)'
            }
          })
          const fetchDuration = Date.now() - fetchStartTime
          
          console.log('[LocationDataModal] Reverse geocoding response:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            duration: `${fetchDuration}ms`,
            headers: Object.fromEntries(response.headers.entries())
          })

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Could not read error response')
            console.error('[LocationDataModal] Reverse geocoding failed:', {
              status: response.status,
              statusText: response.statusText,
              errorText: errorText.substring(0, 200) // First 200 chars
            })
            
            // Fallback: use coordinates as address
            console.log('[LocationDataModal] Using coordinates as fallback address')
            setAddress(coordsString)
            setUseGPS(true)
            setGpsLoading(false)
            setError(`Got your location (${coordsString}), but could not find address. Coordinates saved.`)
            return
          }

          const data = await response.json()
          console.log('[LocationDataModal] Reverse geocoding data received:', {
            display_name: data.display_name,
            address: data.address,
            place_id: data.place_id,
            osm_type: data.osm_type,
            osm_id: data.osm_id
          })

          const formattedAddress = data.display_name || coordsString
          console.log('[LocationDataModal] Setting address to:', formattedAddress)

          setAddress(formattedAddress)
          setUseGPS(true)
          setGpsLoading(false)
          console.log('[LocationDataModal] Location data successfully retrieved and set')
        } catch (err) {
          console.error('[LocationDataModal] Error in reverse geocoding process:', {
            error: err,
            message: err.message,
            stack: err.stack,
            name: err.name
          })
          
          // Fallback: use coordinates if we have them
          if (position?.coords) {
            const { latitude, longitude } = position.coords
            const coordsString = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
            console.log('[LocationDataModal] Using coordinates as fallback due to error')
            setAddress(coordsString)
            setUseGPS(true)
            setGpsLoading(false)
            setError(`Got your location (${coordsString}), but address lookup failed: ${err.message}`)
          } else {
            setError(`Failed to get address: ${err.message}. You can enter it manually.`)
            setGpsLoading(false)
          }
        }
      },
      (err) => {
        console.error('[LocationDataModal] Geolocation error:', {
          code: err.code,
          message: err.message,
          PERMISSION_DENIED: err.PERMISSION_DENIED,
          POSITION_UNAVAILABLE: err.POSITION_UNAVAILABLE,
          TIMEOUT: err.TIMEOUT
        })

        let errorMessage = 'Failed to get your location. '
        
        switch(err.code) {
          case err.PERMISSION_DENIED:
            errorMessage += 'Location permission was denied. Please enable location access in your browser settings or enter an address manually.'
            console.error('[LocationDataModal] User denied location permission')
            break
          case err.POSITION_UNAVAILABLE:
            errorMessage += 'Location information is unavailable. Your device may not be able to determine your location. Please enter an address manually.'
            console.error('[LocationDataModal] Position unavailable - device cannot determine location')
            break
          case err.TIMEOUT:
            errorMessage += 'Location request timed out. Please try again or enter an address manually.'
            console.error('[LocationDataModal] Location request timed out')
            break
          default:
            errorMessage += `Unknown error (code: ${err.code}). Please enter an address manually.`
            console.error('[LocationDataModal] Unknown geolocation error:', err.code)
        }
        
        setError(errorMessage)
        setGpsLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000, // Increased timeout
        maximumAge: 0
      }
    )
  }

  const handleSave = async (e) => {
    e.preventDefault()
    
    if (!address.trim() && !useGPS) {
      setError('Please enter an address or use your current location')
      return
    }

    setLoading(true)
    setError('')

    try {
      let latitude = null
      let longitude = null
      let finalAddress = address.trim()

      // If using GPS, get coordinates from geolocation
      if (useGPS && navigator.geolocation) {
        console.log('[LocationDataModal] Getting GPS coordinates for save operation')
        try {
          const position = await new Promise((resolve, reject) => {
            console.log('[LocationDataModal] Requesting geolocation for save')
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                console.log('[LocationDataModal] Got position for save:', {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy
                })
                resolve(pos)
              },
              (err) => {
                console.error('[LocationDataModal] Error getting GPS coordinates for save:', {
                  code: err.code,
                  message: err.message
                })
                reject(err)
              },
              {
                enableHighAccuracy: true,
                timeout: 10000
              }
            )
          })
          
          if (position) {
            latitude = position.coords.latitude
            longitude = position.coords.longitude
            console.log('[LocationDataModal] Coordinates for save:', { latitude, longitude })
          }
        } catch (err) {
          console.error('[LocationDataModal] Failed to get coordinates during save:', err)
          // Continue without coordinates - address is still saved
          setError(`Warning: Could not get GPS coordinates: ${err.message}. Address will be saved without coordinates.`)
        }
      }

      // Update location with address and coordinates
      const updateData = {
        address: finalAddress || null,
        latitude: latitude,
        longitude: longitude,
        location_data_provided: true,
        location_data_declined: false
      }

      console.log('[LocationDataModal] Saving location data:', {
        locationId: location.id,
        address: finalAddress,
        hasCoordinates: latitude !== null && longitude !== null,
        latitude,
        longitude
      })

      const { data, error: updateError } = await supabase
        .from('dumps')
        .update(updateData)
        .eq('id', location.id)
        .select()
        .single()

      if (updateError) {
        console.error('[LocationDataModal] Database update error:', {
          error: updateError,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code
        })
        throw updateError
      }

      console.log('[LocationDataModal] Location data saved successfully:', data)
      onSave(data)
      onClose()
    } catch (err) {
      console.error('[LocationDataModal] Error in handleSave:', {
        error: err,
        message: err.message,
        stack: err.stack,
        name: err.name
      })
      setError(err.message || 'Failed to save location data')
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = async () => {
    setLoading(true)
    setError('')

    try {
      // Mark location as declined
      const { data, error: updateError } = await supabase
        .from('dumps')
        .update({
          location_data_declined: true,
          location_data_provided: false
        })
        .eq('id', location.id)
        .select()
        .single()

      if (updateError) throw updateError

      onSave(data)
      onClose()
    } catch (err) {
      console.error('Error declining location data:', err)
      setError(err.message || 'Failed to update location')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="location-data-modal-overlay" onClick={onClose}>
      <div
        className="location-data-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <div className="location-data-icon">📍</div>
        <h2>Add Location Details</h2>
        <p>Help us track more specific location data for "{location?.location_name}"</p>

        <form onSubmit={handleSave} className="location-data-form">
          <div className="form-group">
            <label htmlFor="address">Address or Location Description</label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter address or location description"
              className="form-input"
              disabled={loading || gpsLoading}
            />
          </div>

          <div className="gps-section">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              className="gps-button"
              disabled={loading || gpsLoading}
            >
              {gpsLoading ? 'Getting location...' : '📍 Use Current Location'}
            </button>
            {useGPS && (
              <p className="gps-confirmation">✓ Using your current location</p>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="location-data-buttons">
            <button
              type="button"
              onClick={handleSkip}
              className="skip-button"
              disabled={loading || gpsLoading}
            >
              Skip for Now
            </button>
            <button
              type="submit"
              className="save-location-button"
              disabled={loading || gpsLoading || (!address.trim() && !useGPS)}
            >
              {loading ? 'Saving...' : 'Save Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LocationDataModal

