import { useState } from "react";
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
        const { data: authData, error: authError } = await supabase.auth.signUp(
          {
            email,
            password,
            options: {
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

        {error && <div className="error-message">{error}</div>}

        <button type="submit" disabled={loading} className="submit-button">
          {loading ? "Loading..." : isLogin ? "Login" : "Register"}
        </button>
      </form>

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
