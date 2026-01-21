import * as React from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Icon } from './ui/Icon';
import FaceIdLoginModal from './FaceIdLoginModal';

const SAVED_USERNAME_KEY = 'saved_username';
const FACE_ID_AUTOLOGIN_KEY = 'faceIdAutoLogin';
const FACE_ID_SAVED_USERNAME = 'faceIdSavedUsername';

const Login: React.FC = () => {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [rememberMe, setRememberMe] = React.useState(false);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [isFaceIdModalOpen, setIsFaceIdModalOpen] = React.useState(false);
  const [rememberFaceId, setRememberFaceId] = React.useState(false);
  const [isAutoScanning, setIsAutoScanning] = React.useState(false);

  const { login, currentUser, isAuthLoading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    const savedUsername = localStorage.getItem(SAVED_USERNAME_KEY);
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
    const autoLogin = localStorage.getItem(FACE_ID_AUTOLOGIN_KEY);
    if (autoLogin === 'true') {
        const faceIdUsername = localStorage.getItem(FACE_ID_SAVED_USERNAME);
        if (faceIdUsername) {
            setUsername(faceIdUsername);
        }
        setIsAutoScanning(true);
        setIsFaceIdModalOpen(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      if (rememberMe) {
        localStorage.setItem(SAVED_USERNAME_KEY, username);
      } else {
        localStorage.removeItem(SAVED_USERNAME_KEY);
      }
      navigate('/dashboard');
    } catch (err: any) {
        if (err.message && err.message.includes('verify your email')) {
            setError('Your account is not verified. Please check your email for a verification link.');
        } else {
            setError(err.message || 'Failed to log in');
        }
    } finally {
        setLoading(false);
    }
  };

  const handleFaceIdSuccess = () => {
    if (rememberFaceId) {
        localStorage.setItem(FACE_ID_AUTOLOGIN_KEY, 'true');
        localStorage.setItem(FACE_ID_SAVED_USERNAME, username);
    } else {
        localStorage.removeItem(FACE_ID_AUTOLOGIN_KEY);
        localStorage.removeItem(FACE_ID_SAVED_USERNAME);
    }
    setIsFaceIdModalOpen(false);
    navigate('/dashboard');
  };

  if (isAuthLoading) {
    return <div className="flex items-center justify-center h-screen"><Icon name="loader" className="w-12 h-12 animate-spin text-blue-500" /></div>;
  }

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left side: Hero Text */}
            <div className="text-center lg:text-left text-white">
              <div className="flex justify-center lg:justify-start items-center mb-6">
                <div className="p-2 bg-white/20 rounded-lg mr-4 animate-heartbeat">
                  <Icon name="logo" className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-3xl font-bold animate-heartbeat">Aether<span className="text-[var(--accent-color-gold)]">Log</span></h1>
              </div>
              <h2 className="text-5xl md:text-6xl font-bold mb-4 animate-slide-up-fade-in">
                  Turn Log Data into Actionable Insight.
              </h2>
              <p className="text-lg text-gray-300 max-w-xl mx-auto lg:mx-0 animate-slide-up-fade-in" style={{ animationDelay: '200ms' }}>
                  Our AI-powered platform analyzes your logs in real-time to detect anomalies, explain errors, and keep your systems running smoothly.
              </p>
            </div>

            {/* Right side: Login Form */}
            <div className="w-full max-w-md mx-auto">
              <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-8 rounded-2xl shadow-2xl">
                <h3 className="text-center text-3xl font-bold text-white mb-8">
                  Welcome Back
                </h3>
                 {error && (
                  <div className="bg-red-500/20 text-red-300 text-center p-3 rounded-lg mb-4 text-sm">
                    <p>{error}</p>
                    {error.includes('not verified') && (
                      <p className="mt-1">
                        Didn't get an email?{' '}
                        <Link
                          to="/resend-verification"
                          state={{ username }}
                          className="font-bold underline hover:text-red-200"
                        >
                          Resend verification link
                        </Link>
                      </p>
                    )}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                  <div>
                    <label htmlFor="username" className="sr-only">Username</label>
                    <div className="relative">
                      <Icon name="user-circle" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="Username" className="w-full bg-gray-800/50 text-white rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-[var(--accent-color-gold)] border border-gray-600 focus:border-[var(--accent-color-gold)] placeholder:text-gray-400" />
                    </div>
                  </div>
                  <div>
                      <div className="flex justify-between items-center mb-1">
                          <label htmlFor="password"  className="sr-only">Password</label>
                          <Link to="/forgot-password" className="text-xs text-blue-400 hover:underline ml-auto">Forgot Password?</Link>
                      </div>
                    <div className="relative">
                      <Icon name="key" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Password" className="w-full bg-gray-800/50 text-white rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-[var(--accent-color-gold)] border border-gray-600 focus:border-[var(--accent-color-gold)] placeholder:text-gray-400" />
                    </div>
                  </div>
                  <div className="flex items-center">
                      <input id="remember-me" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-blue-500 focus:ring-blue-500" />
                      <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-300">Remember me</label>
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? 'Logging in...' : 'Login'}
                  </button>
                </form>

                <div className="my-6 flex items-center">
                  <div className="flex-grow border-t border-gray-700"></div>
                  <span className="flex-shrink mx-4 text-gray-400 text-sm">OR</span>
                  <div className="flex-grow border-t border-gray-700"></div>
                </div>

                <button type="button" onClick={() => setIsFaceIdModalOpen(true)} className="w-full bg-black/30 hover:bg-black/50 border border-gray-600 text-white font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <Icon name="face-id" className="w-5 h-5" />
                  Login with Face ID
                </button>

                <div className="mt-4 flex items-center justify-center">
                    <input id="remember-face-id" type="checkbox" checked={rememberFaceId} onChange={(e) => setRememberFaceId(e.target.checked)} className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-blue-500 focus:ring-blue-500" />
                    <label htmlFor="remember-face-id" className="ml-2 block text-sm text-gray-300">Remember my face for next time</label>
                </div>

                <p className="text-center text-sm text-gray-400 mt-6">
                    Don't have an account?{' '}
                    <Link to="/signup" className="font-medium text-blue-400 hover:underline">
                        Get Started
                    </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {isFaceIdModalOpen && (
        <FaceIdLoginModal
            username={username}
            onClose={() => setIsFaceIdModalOpen(false)}
            onLoginSuccess={handleFaceIdSuccess}
            autoStart={isAutoScanning}
        />
      )}
    </>
  );
};

export default Login;