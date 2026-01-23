import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import "./LoginForm.css";

function LoginForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showPasswordResetForm, setShowPasswordResetForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);

  // Check if we're in a password reset flow and verify session exists
  useEffect(() => {
    const checkResetFlow = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const isResetFlow = urlParams.get("reset") === "true";
      
      // Also check if we have a recovery token in the hash
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const isRecovery = hashParams.get("type") === "recovery";
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      
      if (isResetFlow || isRecovery) {
        setCheckingSession(true);
        
        // If we have tokens in the hash, set the session first
        if (isRecovery && accessToken) {
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            if (error) {
              setError("Invalid or expired reset link. Please request a new password reset.");
              setCheckingSession(false);
              return;
            }
          } catch (err) {
            setError("Failed to verify reset link. Please request a new password reset.");
            setCheckingSession(false);
            return;
          }
        }
        
        // Verify we have a valid session before showing the form
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          setError("Auth session missing! The reset link may be invalid or expired. Please request a new password reset.");
          setCheckingSession(false);
          return;
        }
        
        // Don't clean up URL here - keep ?reset=true so App.jsx knows to show LoginForm
        // It will be cleaned up after successful password reset
        setShowPasswordResetForm(true);
        setCheckingSession(false);
      }
    };
    
    checkResetFlow();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
      } else {
        // Register
        // Pass first_name and last_name in metadata so the database trigger can use them
        // Set redirectTo to current origin for email verification
        const redirectTo = `${window.location.origin}${window.location.pathname}`;
        const { data: authData, error: authError } = await supabase.auth.signUp(
          {
            email,
            password,
            options: {
              emailRedirectTo: redirectTo,
              data: {
                first_name: firstName,
                last_name: lastName,
              },
            },
          }
        );

        if (authError) throw authError;

        // The database trigger (handle_new_user) will automatically create the users record
        // with the first_name and last_name from the metadata

        // Sign out the user (they need to verify email first)
        await supabase.auth.signOut();

        // Clear form fields
        setFirstName("");
        setLastName("");
        setPassword("");

        // Switch to login view and show verification modal
        setRegisteredEmail(email);
        setIsLogin(true);
        setShowVerificationModal(true);
      }
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setResetLoading(true);

    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${redirectTo}?reset=true`,
      });

      if (error) throw error;

      setResetSuccess(true);
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setResetLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    // Verify session exists before attempting to update password
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      setError("Auth session missing! The reset link may have expired. Please request a new password reset.");
      setPasswordResetLoading(false);
      return;
    }

    setPasswordResetLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      // Password updated successfully, clear reset query param and reload to get fresh session
      window.history.replaceState({}, document.title, window.location.pathname);
      window.location.reload();
    } catch (err) {
      setError(err.message || "An error occurred");
      setPasswordResetLoading(false);
    }
  };

  // Show password reset form if in reset flow
  if (checkingSession || showPasswordResetForm) {
    return (
      <div className="login-container">
        <div className="login-header">
          <span className="emoji">🔐</span>
          <h1>Reset Your Password</h1>
        </div>

        {checkingSession ? (
          <div className="login-form">
            <div className="loading">Verifying reset link...</div>
          </div>
        ) : (
          <>
            {error && error.includes("Auth session missing") ? (
              <div className="login-form">
                <div className="error-message">{error}</div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordResetForm(false);
                    setError("");
                    setNewPassword("");
                    setConfirmPassword("");
                    window.history.replaceState({}, document.title, window.location.pathname);
                  }}
                  className="submit-button"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="login-form">
                <input
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                />
                <input
                  type="password"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />

                {error && <div className="error-message">{error}</div>}

                <button
                  type="submit"
                  disabled={passwordResetLoading}
                  className="submit-button"
                >
                  {passwordResetLoading ? "Updating..." : "Update Password"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-header">
        <span className="emoji">🚽</span>
        <h1>Dump Tracker 2026</h1>
      </div>

      <div className="login-tabs">
        <button
          className={isLogin ? "active" : ""}
          onClick={() => setIsLogin(true)}
        >
          Login
        </button>
        <button
          className={!isLogin ? "active" : ""}
          onClick={() => setIsLogin(false)}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="login-form">
        {!isLogin && (
          <>
            <input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required={!isLogin}
            />
            <input
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required={!isLogin}
            />
          </>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />

        {isLogin && (
          <button
            type="button"
            onClick={() => {
              setShowForgotPassword(true);
              setError("");
              setResetSuccess(false);
              setResetEmail(email);
            }}
            className="forgot-password-link"
          >
            Forgot Password?
          </button>
        )}

        {error && <div className="error-message">{error}</div>}

        <button type="submit" disabled={loading} className="submit-button">
          {loading ? "Loading..." : isLogin ? "Login" : "Register"}
        </button>
      </form>

      {showForgotPassword && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowForgotPassword(false);
            setResetEmail("");
            setResetSuccess(false);
            setError("");
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => {
                setShowForgotPassword(false);
                setResetEmail("");
                setResetSuccess(false);
                setError("");
              }}
            >
              ×
            </button>
            {!resetSuccess ? (
              <>
                <div className="modal-icon">🔐</div>
                <h2>Reset Password</h2>
                <p>
                  Enter your email address and we'll send you a link to reset
                  your password.
                </p>
                <form onSubmit={handleForgotPassword} className="login-form">
                  <input
                    type="email"
                    placeholder="Email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    autoFocus
                  />
                  {error && <div className="error-message">{error}</div>}
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="modal-button"
                  >
                    {resetLoading ? "Sending..." : "Send Reset Link"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="modal-icon">📧</div>
                <h2>Check Your Email</h2>
                <p>
                  We've sent a password reset link to{" "}
                  <strong>{resetEmail}</strong>
                </p>
                <p>
                  Please check your inbox and click the link to reset your
                  password.
                </p>
                <button
                  className="modal-button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetEmail("");
                    setResetSuccess(false);
                  }}
                >
                  Got it!
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showVerificationModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowVerificationModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowVerificationModal(false)}
            >
              ×
            </button>
            <div className="modal-icon">📧</div>
            <h2>Check Your Email</h2>
            <p>
              We've sent a verification email to{" "}
              <strong>{registeredEmail}</strong>
            </p>
            <p>
              Please check your inbox and click the verification link to
              activate your account.
            </p>
            <button
              className="modal-button"
              onClick={() => setShowVerificationModal(false)}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginForm;
