import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import LoginForm from './components/LoginForm'
import Dashboard from './components/Dashboard'
import Settings from './components/Settings'
import Leaderboard from './components/Leaderboard'
import News from './components/News'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState('dashboard')
  const [isPasswordReset, setIsPasswordReset] = useState(false)

  useEffect(() => {
    // Check if we're in a password reset flow
    const urlParams = new URLSearchParams(window.location.search);
    const isResetFlow = urlParams.get("reset") === "true";
    
    // Also check if we have a recovery token in the hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const isRecovery = hashParams.get("type") === "recovery";
    
    if (isResetFlow || isRecovery) {
      setIsPasswordReset(true);
    }

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
              // For recovery (password reset), add query param so LoginForm knows to show reset form
              const newUrl = type === 'recovery' 
                ? `${window.location.pathname}?reset=true`
                : window.location.pathname;
              // Clear the hash from URL
              window.history.replaceState(null, '', newUrl);
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
      {/* Show LoginForm if in password reset flow, even if user has a session */}
      {isPasswordReset ? (
        <LoginForm />
      ) : user ? (
        currentView === 'settings' ? (
          <Settings user={user} onBack={() => setCurrentView('dashboard')} />
        ) : currentView === 'leaderboard' ? (
          <Leaderboard user={user} onBack={() => setCurrentView('dashboard')} />
        ) : currentView === 'news' ? (
          <News user={user} onBack={() => setCurrentView('dashboard')} />
        ) : (
          <Dashboard 
            user={user} 
            onNavigateToSettings={() => setCurrentView('settings')}
            onNavigateToLeaderboard={() => setCurrentView('leaderboard')}
            onNavigateToNews={() => setCurrentView('news')}
          />
        )
      ) : (
        <LoginForm />
      )}
    </div>
  )
}

export default App

