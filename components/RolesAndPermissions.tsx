import * as React from 'react';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { Role } from '../types';

const PermissionCheck: React.FC<{ allowed: boolean }> = ({ allowed }) => {
    return allowed ? (
        <Icon name="check-circle" className="w-6 h-6 text-green-500 mx-auto" />
    ) : (
        <Icon name="x-circle" className="w-6 h-6 text-red-500 mx-auto" />
    );
};

const RolesAndPermissions: React.FC = () => {
    const permissions = [
        { name: 'View Logs & Dashboards', owner: true, admin: true, analyst: true, member: true },
        { name: 'Save Learned Insights', owner: true, admin: true, analyst: true, member: false },
        { name: 'Receive Critical Alerts', owner: true, admin: true, analyst: true, member: false },
        { name: 'Manage API Keys', owner: true, admin: true, analyst: false, member: false },
        { name: 'Manage Team Members', owner: true, admin: true, analyst: false, member: false },
        { name: 'Manage Billing & Subscription', owner: true, admin: true, analyst: false, member: false },
        { name: 'Delete Organization', owner: true, admin: false, analyst: false, member: false },
    ];

    const roles = [Role.OWNER, Role.ADMIN, Role.ANALYST, Role.MEMBER];

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Roles & Permissions</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    This document outlines the granular Role-Based Access Control (RBAC) model implemented in the AI Log Analyzer.
                </p>
            </div>

            <Card>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Permission Matrix</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th className="px-6 py-3">Permission</th>
                                {roles.map(role => (
                                    <th key={role} className="px-6 py-3 text-center">{role}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="text-gray-700 dark:text-gray-300">
                            {permissions.map((perm, index) => (
                                <tr key={perm.name} className={`${index % 2 === 0 ? 'bg-white dark:bg-gray-900/50' : 'bg-gray-50/50 dark:bg-gray-800/50'}`}>
                                    <td className="px-6 py-4 font-medium">{perm.name}</td>
                                    <td className="px-6 py-4 text-center"><PermissionCheck allowed={perm.owner} /></td>
                                    <td className="px-6 py-4 text-center"><PermissionCheck allowed={perm.admin} /></td>
                                    <td className="px-6 py-4 text-center"><PermissionCheck allowed={perm.analyst} /></td>
                                    <td className="px-6 py-4 text-center"><PermissionCheck allowed={perm.member} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
            
            <Card>
                 <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Role Descriptions</h3>
                 <div className="space-y-4">
                    <div>
                        <h4 className="font-bold text-gray-800 dark:text-gray-200">Owner</h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Has ultimate control over the organization, including all Admin permissions plus the ability to manage billing and delete the organization.</p>
                    </div>
                     <div>
                        <h4 className="font-bold text-gray-800 dark:text-gray-200">Admin</h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Can manage day-to-day organizational settings, invite and manage users, and configure data sources.</p>
                    </div>
                     <div>
                        <h4 className="font-bold text-gray-800 dark:text-gray-200">Analyst</h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">A power user who can view all data, receive critical alerts, and contribute to the team's knowledge base by saving learned insights. Cannot change settings.</p>
                    </div>
                     <div>
                        <h4 className="font-bold text-gray-800 dark:text-gray-200">Member</h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Has read-only access to view logs and dashboards. This role is ideal for developers or stakeholders who need visibility without administrative rights.</p>
                    </div>
                 </div>
            </Card>
        </div>
    );
};

export default RolesAndPermissions;