import * as React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { verifyEmailToken } from '../services/authService';
import { Icon } from './ui/Icon';
import { Card } from './ui/Card';

const EmailVerificationPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = React.useState<'verifying' | 'success' | 'error'>('verifying');
    const [message, setMessage] = React.useState('Verifying your email address...');

    React.useEffect(() => {
        const token = searchParams.get('token');
        if (!token) {
            setStatus('error');
            setMessage('No verification token found. Please check the link or try signing up again.');
            return;
        }

        const verify = async () => {
            try {
                const response = await verifyEmailToken(token);
                setStatus('success');
                setMessage(response.message);
            } catch (err: any) {
                if (err.status === 409) { // 409 Conflict for "Already Verified"
                    setStatus('success'); // Treat it as a success for UI purposes
                    setMessage(err.message || 'Account is already verified.');
                } else {
                    setStatus('error');
                    setMessage(err.message || 'An unknown error occurred during verification.');
                }
            }
        };

        verify();
    }, [searchParams]);

    const StatusDisplay = () => {
        switch (status) {
            case 'verifying':
                return (
                    <>
                        <Icon name="loader" className="w-16 h-16 text-blue-500 animate-spin" />
                        <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-100">{message}</h2>
                    </>
                );
            case 'success':
                return (
                    <>
                        <Icon name="check-circle" className="w-16 h-16 text-green-500" />
                        <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Verification Successful!</h2>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">{message}</p>
                        <Link to="/login" className="mt-6 inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors">
                            Proceed to Login
                        </Link>
                    </>
                );
            case 'error':
                 return (
                    <>
                        <Icon name="exclamation-triangle" className="w-16 h-16 text-red-500" />
                        <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Verification Failed</h2>
                        <p className="mt-2 text-red-600 dark:text-red-400 max-w-md mx-auto">{message}</p>
                        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                            <Link to="/login" className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg text-white font-semibold transition-colors">
                                Go to Login
                            </Link>
                            <Link to="/resend-verification" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors">
                                Request New Link
                            </Link>
                        </div>
                    </>
                );
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
            <Card className="w-full max-w-lg text-center">
                <div className="p-8 flex flex-col items-center justify-center">
                    <StatusDisplay />
                </div>
            </Card>
        </div>
    );
};

export default EmailVerificationPage;