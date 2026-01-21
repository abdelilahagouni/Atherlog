import * as React from 'react';
import { User } from '../types';
import { Icon } from './ui/Icon';

interface ConfirmRemoveMemberModalProps {
  user: User;
  onClose: () => void;
  onConfirm: () => void;
  isRemoving: boolean;
}

const ConfirmRemoveMemberModal: React.FC<ConfirmRemoveMemberModalProps> = ({ user, onClose, onConfirm, isRemoving }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Icon name="trash" className="w-6 h-6 text-red-500" />
            Confirm Removal
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors" disabled={isRemoving}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300">
            Are you sure you want to remove <span className="font-bold text-gray-900 dark:text-white">{user.username}</span> from the organization? This action cannot be undone.
          </p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-b-2xl flex justify-end gap-4">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-gray-800 dark:text-gray-100 font-semibold transition-colors"
            disabled={isRemoving}
          >
            Cancel
          </button>
          <button 
            type="button" 
            onClick={onConfirm} 
            disabled={isRemoving} 
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isRemoving && <Icon name="loader" className="w-4 h-4 animate-spin" />}
            {isRemoving ? 'Removing...' : 'Remove Member'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmRemoveMemberModal;