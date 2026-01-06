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
      // Check for hash fragments in URL (from email verification link)
      if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        if ((type === 'signup' || type === 'recovery') && accessToken) {
          try {
            // Set the session using the tokens from the URL
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            if (error) {
              console.error('Error setting session:', error);
            } else {
              // Clear the hash from URL
              window.history.replaceState(null, '', window.location.pathname);
              // Reload to ensure state is updated
              window.location.reload();
            }
          } catch (err) {
            console.error('Error during email verification:', err);
          }
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

