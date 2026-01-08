import * as React from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Icon } from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { resetPassword } from '../services/authService';
import { Card } from './ui/Card';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const [password, setPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const { showToast } = useToast();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            showToast('Passwords do not match.', 'error');
            return;
        }
        if (!token) {
            showToast('Invalid or missing reset token.', 'error');
            return;
        }
        setLoading(true);
        try {
            await resetPassword(token, password);
            showToast('Password reset successfully! You can now log in.', 'success');
            navigate('/login');
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="flex items-center justify-center min-h-screen text-center p-4">
                 <Card className="w-full max-w-md text-center">
                    <Icon name="exclamation-triangle" className="w-12 h-12 mx-auto text-red-500" />
                    <h2 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">Invalid Link</h2>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">The password reset link is missing or invalid. Please request a new one.</p>
                     <Link to="/forgot-password"  className="mt-6 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold">Request New Link</Link>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="flex justify-center items-center mb-8">
                <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded-lg mr-3 animate-heartbeat">
                    <Icon name="logo" className="w-8 h-8 text-gray-800 dark:text-gray-200" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 animate-heartbeat">Aether<span className="text-[var(--accent-color-gold)]">Log</span></h1>
            </div>
            <Card className="w-full max-w-md text-center">
                <Icon name="shield-check" className="w-12 h-12 mx-auto text-blue-500" />
                <h2 className="mt-4 text-3xl font-bold text-gray-900 dark:text-gray-100">Reset Your Password</h2>
                <form onSubmit={handleSubmit} className="space-y-4 mt-8 text-left">
                    <div>
                        <label className="sr-only">New Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="New Password" className="w-full p-3 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700" />
                    </div>
                    <div>
                        <label className="sr-only">Confirm New Password</label>
                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Confirm New Password" className="w-full p-3 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700" />
                    </div>
                    <button type="submit" disabled={loading} className="w-full p-3 bg-blue-600 text-white rounded-lg font-semibold disabled:bg-blue-400 hover:bg-blue-700 transition-colors">
                        {loading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>
                 <p className="text-center mt-8 text-sm">
                    <Link to="/login" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">Back to Login</Link>
                </p>
            </Card>
        </div>
    );
};

export default ResetPassword;