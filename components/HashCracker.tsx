import * as React from 'react';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';

const HashCracker: React.FC = () => {
    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Hash Cracker</h2>
            <Card>
                <div className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-full mb-6">
                        <Icon name="lock-open" className="w-12 h-12 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Decrypt & Crack Hashes</h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
                        Enter a hash (MD5, SHA1, SHA256, bcrypt) to attempt recovery using our rainbow tables and GPU cluster.
                    </p>
                    <div className="w-full max-w-lg flex gap-2">
                        <input 
                            type="text" 
                            placeholder="e.g. 5d41402abc4b2a76b9719d911017c592" 
                            className="flex-grow bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 font-mono"
                        />
                        <button className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors">
                            Crack
                        </button>
                    </div>
                </div>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="font-semibold mb-4">Supported Algorithms</h3>
                    <div className="flex flex-wrap gap-2">
                        {['MD5', 'SHA1', 'SHA256', 'SHA512', 'bcrypt', 'NTLM', 'MySQL'].map(algo => (
                            <span key={algo} className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm font-mono">{algo}</span>
                        ))}
                    </div>
                </Card>
                <Card>
                    <h3 className="font-semibold mb-4">Cluster Status</h3>
                    <div className="flex items-center gap-2 text-green-500">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <span className="font-medium">Online (4 Nodes Active)</span>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default HashCracker;
