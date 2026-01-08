import * as React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { forgotPassword } from '../services/authService';
import { Card } from './ui/Card';

const ForgotPassword = () => {
    const [username, setUsername] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const { showToast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await forgotPassword(username);
            showToast('If an account exists, a reset link has been logged to the backend console.', 'success');
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
             <div className="flex justify-center items-center mb-8">
                <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded-lg mr-3 animate-heartbeat">
                    <Icon name="logo" className="w-8 h-8 text-gray-800 dark:text-gray-200" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 animate-heartbeat">Aether<span className="text-[var(--accent-color-gold)]">Log</span></h1>
            </div>
            <Card className="w-full max-w-md text-center">
                <Icon name="key" className="w-12 h-12 mx-auto text-blue-500" />
                <h2 className="mt-4 text-3xl font-bold text-gray-900 dark:text-gray-100">Forgot Password</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Enter your username and we'll log a reset link to the backend console for this demo.</p>
                <form onSubmit={handleSubmit} className="space-y-6 mt-8">
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)} required placeholder="Username" className="w-full p-3 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-center" />
                    <button type="submit" disabled={loading} className="w-full p-3 bg-blue-600 text-white rounded-lg font-semibold disabled:bg-blue-400 hover:bg-blue-700 transition-colors">
                        {loading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                </form>
                <p className="text-center mt-8 text-sm">
                    <Link to="/login" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">Back to Login</Link>
                </p>
            </Card>
        </div>
    );
};

export default ForgotPassword;