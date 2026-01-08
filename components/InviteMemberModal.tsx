import * as React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Icon } from './ui/Icon';
import { Role } from '../types';
import { useToast } from '../hooks/useToast';

interface InviteMemberModalProps {
    onClose: () => void;
}

const InviteMemberModal: React.FC<InviteMemberModalProps> = ({ onClose }) => {
    const [email, setEmail] = React.useState('');
    const [role, setRole] = React.useState<Role>(Role.MEMBER);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');
    const { inviteMember } = useAuth();
    const { showToast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await inviteMember(email, role);
            showToast(`Invitation sent to ${email}`, 'success');
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to send invitation');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-lg">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Invite New Member</h2>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        {error && <p className="bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 text-center p-3 rounded-lg">{error}</p>}
                        <div>
                            <label htmlFor="email" className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-2">Email Address</label>
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
                            <label htmlFor="role" className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-2">Role</label>
                            <select
                                id="role"
                                value={role}
                                onChange={(e) => setRole(e.target.value as Role)}
                                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600"
                            >
                                {Object.values(Role).filter(r => r !== Role.OWNER).map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-b-2xl flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-gray-800 dark:text-gray-100 font-semibold transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            {loading ? 'Sending...' : 'Send Invitation'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InviteMemberModal;