import { DeploymentCheckpoint } from '../types';

const mockHistory: DeploymentCheckpoint[] = [
    {
        id: 'cp-3',
        version: 'v1.2.0 - Current',
        timestamp: new Date().toISOString(),
        description: 'Feature: Turn Log Data into Actionable Insight. Added Proactive AI Insights to the main dashboard and enhanced the visual design.',
        isCurrent: true,
    },
    {
        id: 'cp-2',
        version: 'v1.1.5',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Hotfix: Patched a memory leak in the log ingestion service. Improved query performance in the Log Explorer.',
        isCurrent: false,
    },
    {
        id: 'cp-1',
        version: 'v1.1.0',
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Feature: Introduced the Visual Log Parser and Live Object Detector. Upgraded AI model for better text extraction.',
        isCurrent: false,
    },
];

export const getDeploymentHistory = (): Promise<DeploymentCheckpoint[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(mockHistory);
        }, 500); // Simulate network delay
    });
};