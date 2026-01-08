import * as React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Icon } from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { resendVerificationLink } from '../services/authService';

const ResendVerificationPage = () => {
    const location = useLocation();
    const [usernameOrEmail, setUsernameOrEmail] = React.useState(location.state?.username || '');
    const [loading, setLoading] = React.useState(false);
    const { showToast } = useToast();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await resendVerificationLink(usernameOrEmail);
            showToast('If an unverified account exists, a new verification link has been sent to the associated email.', 'success');
            navigate('/login');
        } catch (err: any) {
            if (err.status === 409) { // 409 Conflict for "Already Verified"
                showToast(err.message, 'info');
                navigate('/login');
            } else {
                showToast(err.message || 'An error occurred.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
            <div className="w-full max-w-2xl">
                <div className="flex justify-center items-center mb-6">
                    <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded-lg mr-3 animate-heartbeat">
                    <Icon name="logo" className="w-8 h-8 text-gray-800 dark:text-gray-200" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 animate-heartbeat">Aether<span className="text-[var(--accent-color-gold)]">Log</span></h1>
                </div>
                
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-2">Resend Verification Email</h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                  Enter your username or email address below to receive a new verification link.
                </p>

                <div className="w-full max-w-sm mx-auto">
                    <form onSubmit={handleSubmit} className="space-y-4 text-left">
                        <div>
                        <label htmlFor="usernameOrEmail" className="sr-only">Username or Email</label>
                        <div className="relative">
                            <Icon name="user-circle" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                            <input
                            id="usernameOrEmail"
                            type="text"
                            value={usernameOrEmail}
                            onChange={(e) => setUsernameOrEmail(e.target.value)}
                            required
                            placeholder="Username or Email"
                            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600"
                            />
                        </div>
                        </div>
                        <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                        {loading ? 'Sending...' : 'Send Verification Link'}
                        </button>
                    </form>

                    <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
                        Account already verified?{' '}
                        <Link to="/login" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                            Back to Login
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ResendVerificationPage;