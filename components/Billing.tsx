

import * as React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { PLAN_DETAILS, PlanCard } from './ui/PlanCard';

const UsageBar: React.FC<{ label: string; value: number; max: number }> = ({ label, value, max }) => {
    const isUnlimited = max === null || max === Infinity;
    const percentage = isUnlimited || !max ? 0 : Math.min((value / max) * 100, 100);
    const isOverQuota = !isUnlimited && percentage >= 100;

    return (
        <div>
            <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-300">{label}</span>
                <span className={`font-semibold ${isOverQuota ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {value.toLocaleString()} / {isUnlimited ? 'Unlimited' : max.toLocaleString()}
                </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div
                    className={`h-2.5 rounded-full ${isOverQuota ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
};

const Billing: React.FC = () => {
    const { currentOrganization, organizationMembers } = useAuth();

    if (!currentOrganization) {
        return (
             <div className="flex items-center justify-center h-full">
                <Icon name="loader" className="w-12 h-12 animate-spin text-blue-500" />
            </div>
        )
    }

    const currentPlan = currentOrganization.plan;
    // This is a simulated value. In a real app, this would come from a database.
    const simulatedLogUsage = 12500; 

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Billing & Plan</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">View your current plan, usage, and available upgrades.</p>
            </div>
            
            <Card>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Current Usage</h3>
                <div className="space-y-4">
                    <UsageBar label="Log Events This Month" value={simulatedLogUsage} max={currentPlan.quotas.logsPerMonth} />
                    <UsageBar label="Team Members" value={organizationMembers.length} max={currentPlan.quotas.members} />
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <PlanCard plan={PLAN_DETAILS.Free} isCurrent={currentPlan.name === 'Free'} />
                <PlanCard plan={PLAN_DETAILS.Pro} isCurrent={currentPlan.name === 'Pro'} />
                <PlanCard plan={PLAN_DETAILS.Enterprise} isCurrent={currentPlan.name === 'Enterprise'} />
            </div>
        </div>
    );
};

export default Billing;