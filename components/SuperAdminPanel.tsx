import * as React from 'react';
import { User } from '../types';
import { getAllUsersForSuperAdmin } from '../services/authService';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import UserDetailsModal from './UserDetailsModal';

const SuperAdminPanel: React.FC = () => {
    const [users, setUsers] = React.useState<(User & { organizationName: string })[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedUser, setSelectedUser] = React.useState<User | null>(null);

    React.useEffect(() => {
        const fetchUsers = async () => {
            try {
                const allUsers = await getAllUsersForSuperAdmin();
                setUsers(allUsers);
            } catch (err: any) {
                setError(err.message || "Failed to fetch user data.");
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    const filteredUsers = React.useMemo(() => {
        return users.filter(user =>
            user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.organizationName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [users, searchTerm]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Icon name="loader" className="w-12 h-12 animate-spin text-blue-500" />
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="text-center py-8 bg-red-500/10 p-4 rounded-lg">
                <p className="text-red-700 dark:text-red-300 font-semibold">An error occurred:</p>
                <p className="text-red-600 dark:text-red-400 mt-1">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Super Admin Panel</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">A complete overview of all users and organizations on the platform.</p>
            </div>

            <Card>
                <div className="mb-4">
                    <label htmlFor="search-users" className="sr-only">Search Users</label>
                    <div className="relative">
                        <Icon name="search" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                        <input
                            id="search-users"
                            type="text"
                            placeholder="Search by username, email, or organization..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full md:w-1/2 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
                        <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-transparent">
                            <tr>
                                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Username</th>
                                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Email</th>
                                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Organization</th>
                                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Role</th>
                                <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => (
                                <tr 
                                    key={user.id} 
                                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                                    onClick={() => setSelectedUser(user)}
                                >
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{user.username}</td>
                                    <td className="px-6 py-4 font-mono text-xs">{user.email}</td>
                                    <td className="px-6 py-4">{user.organizationName}</td>
                                    <td className="px-6 py-4">{user.role}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.isVerified ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300'}`}>
                                            {user.isVerified ? 'Verified' : 'Pending'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
            {selectedUser && <UserDetailsModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
        </div>
    );
};

export default SuperAdminPanel;