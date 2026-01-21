import * as React from 'react';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';

const SocialRecon: React.FC = () => {
    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Social Reconnaissance</h2>
            <Card>
                <div className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full mb-6">
                        <Icon name="users" className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Social Graph Analysis</h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
                        Enter a target username or email to map their social footprint across 300+ platforms.
                    </p>
                    <div className="w-full max-w-md flex gap-2">
                        <input 
                            type="text" 
                            placeholder="e.g. johndoe, john@example.com" 
                            className="flex-grow bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2"
                        />
                        <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors">
                            Scan
                        </button>
                    </div>
                </div>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <h3 className="font-semibold mb-4">Recent Scans</h3>
                    <div className="text-sm text-gray-500">No recent scans found.</div>
                </Card>
                <Card>
                    <h3 className="font-semibold mb-4">Sentiment Analysis</h3>
                    <div className="text-sm text-gray-500">Connect a data source to analyze sentiment.</div>
                </Card>
                <Card>
                    <h3 className="font-semibold mb-4">Network Graph</h3>
                    <div className="text-sm text-gray-500">Visualization will appear here after scan.</div>
                </Card>
            </div>
        </div>
    );
};

export default SocialRecon;
