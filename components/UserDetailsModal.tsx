import * as React from 'react';
import { User } from '../types';
import { Icon } from './ui/Icon';

interface UserDetailsModalProps {
  user: User;
  onClose: () => void;
}

const DetailItem: React.FC<{ label: string; value: string | number; fullWidth?: boolean }> = ({ label, value, fullWidth = false }) => (
  <div className={fullWidth ? 'sm:col-span-2' : ''}>
    <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    <p className="text-md text-gray-900 dark:text-gray-100 font-semibold truncate">{value}</p>
  </div>
);

const UserDetailsModal: React.FC<UserDetailsModalProps> = ({ user, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <Icon name="user-circle" className="w-8 h-8 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">User Details</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-8">
                <DetailItem label="Username" value={user.username} />
                <DetailItem label="Role" value={user.role} />
                <DetailItem label="Email" value={user.email} />
                <DetailItem label="Job Title" value={user.jobTitle} />
                <DetailItem 
                    label="Salary" 
                    value={user.salary ? `$${user.salary.toLocaleString('en-US')}` : 'N/A'} 
                />
                <DetailItem 
                    label="Hire Date" 
                    value={user.hireDate ? new Date(user.hireDate).toLocaleDateString() : 'N/A'} 
                />
                 <DetailItem label="User ID" value={user.id} fullWidth={true} />
            </div>
        </div>

        <div className="p-4 mt-auto border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/20 text-right rounded-b-2xl flex-shrink-0">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-gray-800 dark:text-gray-100 font-semibold transition-colors"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};

export default UserDetailsModal;
