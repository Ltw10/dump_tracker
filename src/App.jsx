import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import LoginForm from './components/LoginForm'
import Dashboard from './components/Dashboard'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Handle email verification callback
    const handleEmailVerification = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      if (hashParams.get('type') === 'signup' && hashParams.get('access_token')) {
        // Exchange the code for a session
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error verifying email:', error);
        } else if (data.session) {
          // Clear the hash from URL
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    };

    handleEmailVerification();

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="app-container">
      {user ? <Dashboard user={user} /> : <LoginForm />}
    </div>
  )
}

export default App

