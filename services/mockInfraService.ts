// services/mockInfraService.ts
import { Container, Pod, ContainerStatus, PodStatus } from '../types';

let mockContainers: Container[] = [
    { id: 'a1b2c3d4', name: 'api-gateway', image: 'nginx:1.25-alpine', status: ContainerStatus.Running, cpuUsage: 15.2, memoryUsage: 128, uptime: '3d 4h' },
    { id: 'b2c3d4e5', name: 'user-service', image: 'node:18-alpine', status: ContainerStatus.Running, cpuUsage: 30.5, memoryUsage: 256, uptime: '3d 4h' },
    { id: 'c3d4e5f6', name: 'db-replicator', image: 'python:3.10-slim', status: ContainerStatus.Running, cpuUsage: 5.8, memoryUsage: 512, uptime: '12d 1h' },
    { id: 'd4e5f6g7', name: 'frontend-logger', image: 'node:18-alpine', status: ContainerStatus.Running, cpuUsage: 2.1, memoryUsage: 64, uptime: '3d 4h' },
    { id: 'e5f6g7h8', name: 'auth-service', image: 'python:3.10-slim', status: ContainerStatus.Stopped, cpuUsage: 0, memoryUsage: 0, uptime: '0s' },
];

let mockPods: Pod[] = [
    { id: 'pod1', name: 'frontend-deployment-xyz', namespace: 'production', status: PodStatus.Running, restarts: 0, cpuUsage: '150m', memoryUsage: '300Mi', age: '5d' },
    { id: 'pod2', name: 'backend-api-deployment-abc', namespace: 'production', status: PodStatus.Running, restarts: 2, cpuUsage: '400m', memoryUsage: '600Mi', age: '5d' },
    { id: 'pod3', name: 'data-importer-cronjob-123', namespace: 'default', status: PodStatus.Succeeded, restarts: 0, cpuUsage: 'N/A', memoryUsage: 'N/A', age: '2h' },
    { id: 'pod4', name: 'new-feature-test-pod-def', namespace: 'staging', status: PodStatus.Pending, restarts: 0, cpuUsage: '0m', memoryUsage: '0Mi', age: '5m' },
    { id: 'pod5', name: 'auth-service-deployment-ghi', namespace: 'production', status: PodStatus.Failed, restarts: 5, cpuUsage: '200m', memoryUsage: '250Mi', age: '1d' },
];


// Function to simulate real-time metric fluctuations
const simulateFluctuations = () => {
    mockContainers = mockContainers.map(c => {
        if (c.status === ContainerStatus.Running) {
            // Fluctuate CPU and Memory
            const cpuFluctuation = (Math.random() - 0.5) * 10;
            const memFluctuation = (Math.random() - 0.5) * 20;
            c.cpuUsage = Math.max(5, Math.min(99, c.cpuUsage + cpuFluctuation));
            c.memoryUsage = Math.max(50, c.memoryUsage + memFluctuation);

            // Randomly simulate a restart
            if (Math.random() < 0.05) { // 5% chance to start restarting
                c.status = ContainerStatus.Restarting;
                setTimeout(() => {
                    // Find the container and set it back to running after a delay
                    const restartingContainer = mockContainers.find(rc => rc.id === c.id);
                    if (restartingContainer) {
                        restartingContainer.status = ContainerStatus.Running;
                    }
                }, 3000); // Stays in "Restarting" for 3 seconds
            }
        }
        return c;
    });

    mockPods = mockPods.map(p => {
        if (p.status === PodStatus.Running) {
            const restarts = p.restarts + (Math.random() < 0.01 ? 1 : 0);
            return { ...p, restarts };
        }
        return p;
    });
};

// Start simulating fluctuations in the background
setInterval(simulateFluctuations, 2000);


// Mock data for Container Insights
export const getContainers = (): Promise<Container[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(JSON.parse(JSON.stringify(mockContainers))); // Return a deep copy
        }, 150);
    });
};

export const getPods = (): Promise<Pod[]> => {
     return new Promise(resolve => {
        setTimeout(() => {
            resolve(JSON.parse(JSON.stringify(mockPods))); // Return a deep copy
        }, 150);
    });
}