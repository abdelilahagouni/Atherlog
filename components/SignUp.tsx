import * as React from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Icon } from './ui/Icon';
import { useToast } from '../hooks/useToast';

interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  criteria: {
    text: string;
    met: boolean;
  }[];
}

const calculatePasswordStrength = (password: string): PasswordStrength => {
  const criteria = [
    { text: 'At least 8 characters', met: password.length >= 8 },
    { text: 'A lowercase letter', met: /[a-z]/.test(password) },
    { text: 'An uppercase letter', met: /[A-Z]/.test(password) },
    { text: 'A number', met: /[0-9]/.test(password) },
    { text: 'A special character', met: /[^a-zA-Z0-9]/.test(password) },
  ];

  if (!password) {
    return { score: 0, label: '', criteria: criteria.map(c => ({...c, met: false})) };
  }

  let score: PasswordStrength['score'] = 0;
  let label = '';
  
  const charTypesMet = criteria.slice(1).filter(c => c.met).length;

  if (!criteria[0].met) { // length check
    score = 0;
    label = 'Too short';
  } else {
      if (charTypesMet <= 1) {
          score = 1;
          label = 'Weak';
      } else if (charTypesMet === 2) {
          score = 2;
          label = 'Medium';
      } else if (charTypesMet === 3) {
          score = 3;
          label = 'Strong';
      } else { // 4 char types met
          score = 4;
          label = 'Very Strong';
      }
  }
  
  return { score, label, criteria };
};


const PasswordStrengthIndicator: React.FC<{ strength: PasswordStrength }> = ({ strength }) => {
  const { score, label, criteria } = strength;
  
  if (!label) return null;

  const barColors = [
    'bg-gray-300 dark:bg-gray-600', // Default
    'bg-red-500', // Weak
    'bg-yellow-500', // Medium
    'bg-green-500', // Strong
    'bg-green-600', // Very Strong
  ];

  const textColor = score < 2 ? 'text-red-600 dark:text-red-400' : score === 2 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400';

  return (
    <div className="mt-2 space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 flex gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className={`h-1.5 flex-1 rounded-full transition-colors ${index < score ? barColors[score] : barColors[0]}`}
            />
          ))}
        </div>
        <span className={`text-xs font-semibold w-20 text-right ${textColor}`}>{label}</span>
      </div>

      {criteria && (
          <ul className="text-xs grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              {criteria.map((c, i) => (
                  <li key={i} className={`flex items-center gap-1.5 transition-colors ${c.met ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {c.met ? 
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> :
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                      }
                      <span>{c.text}</span>
                  </li>
              ))}
          </ul>
      )}
    </div>
  );
};


const SignUp: React.FC = () => {
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [organizationName, setOrganizationName] = React.useState('');
  const [jobTitle, setJobTitle] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const { signup, currentUser, isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const passwordStrength = React.useMemo(() => calculatePasswordStrength(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    if (passwordStrength.score < 3) {
      return setError('Password is not strong enough. Please fulfill all criteria for a stronger password.');
    }
    setError('');
    setLoading(true);
    try {
      await signup(username, email, password, organizationName, jobTitle);
      
      showToast(`Welcome, ${username}! Please check your email to verify your account.`, 'success');
      navigate('/login');

    } catch (err: any) {
      setError(err.message || 'Failed to create an account');
    } finally {
      setLoading(false);
    }
  };

  if (isAuthLoading) {
    return <div className="flex items-center justify-center h-screen"><Icon name="loader" className="w-12 h-12 animate-spin text-blue-500" /></div>;
  }

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }


  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
       <div className="w-full max-w-2xl">
           <div className="flex justify-center items-center mb-6">
              <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded-lg mr-3 animate-heartbeat">
              <Icon name="logo" className="w-8 h-8 text-gray-800 dark:text-gray-200" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 animate-heartbeat">Aether<span className="text-[var(--accent-color-gold)]">Log</span></h1>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-2">Create an Account</h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">Join the platform to start analyzing logs.</p>
          
          <div className="w-full max-w-sm mx-auto">
            {error && <p className="bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 text-center p-3 rounded-lg mb-4">{error}</p>}
            
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label htmlFor="organizationName"  className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-2">Organization Name</label>
                <div className="relative">
                  <Icon name="users-group" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <input
                    id="organizationName"
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    required
                    className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>
              <div>
                  <label htmlFor="jobTitle" className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-2">Your Job Title</label>
                  <div className="relative">
                      <Icon name="user-circle" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                      <input
                          id="jobTitle"
                          type="text"
                          list="job-titles"
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                          required
                          className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600"
                      />
                      <datalist id="job-titles">
                          <option value="DevOps Engineer" />
                          <option value="Cloud Architect" />
                          <option value="Site Reliability Engineer (SRE)" />
                          <option value="Software Developer" />
                          <option value="Systems Administrator" />
                          <option value="Security Engineer" />
                          <option value="Data Engineer" />
                          <option value="IT Manager" />
                      </datalist>
                  </div>
              </div>
               <div>
                <label htmlFor="email" className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-2">Your Email Address</label>
                <div className="relative">
                    <Icon name="envelope" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600"
                    />
                </div>
              </div>
              <div>
                <label htmlFor="username"  className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-2">Your Username</label>
                <div className="relative">
                  <Icon name="user-circle" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="password"  className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-2">Password</label>
                <div className="relative">
                  <Icon name="key" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600"
                  />
                </div>
                {password.length > 0 && <PasswordStrengthIndicator strength={passwordStrength} />}
              </div>
              <div>
                <label htmlFor="confirm-password"  className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-2">Confirm Password</label>
                <div className="relative">
                  <Icon name="key" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed !mt-6"
              >
                {loading ? 'Creating Account...' : 'Sign Up'}
              </button>
            </form>
             <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                Log in
              </Link>
            </p>
          </div>
      </div>
    </div>
  );
};

export default SignUp;