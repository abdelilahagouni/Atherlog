import * as React from 'react';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import { PLAN_DETAILS, PlanCard } from './ui/PlanCard';
import { Role } from '../types';

const FeatureGatingDetail: React.FC<{ feature: string, tiers: string }> = ({ feature, tiers }) => (
    <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <span className="font-medium text-gray-800 dark:text-gray-200">{feature}</span>
        <span className="text-sm text-gray-600 dark:text-gray-400 font-semibold">{tiers}</span>
    </div>
);


const SaaSSubscription: React.FC = () => {
    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">SaaS Subscription Model Details</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    This document outlines the Software-as-a-Service (SaaS) architecture and business model for the AI Log Analyzer platform, as requested for the TÜBİTAK report.
                </p>
            </div>

            <Card>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <Icon name="logo" className="w-6 h-6" />
                    Core SaaS Concept
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                    The AI Log Analyzer is designed as a multi-tenant SaaS platform. This means a single, centralized instance of the application serves multiple distinct customer organizations. Each organization's data (users, logs, settings) is logically isolated and secured, ensuring privacy and data integrity. The platform is offered on a subscription basis, providing continuous access to the service, including updates and support, in exchange for a recurring fee.
                </p>
            </Card>

            <section>
                 <h3 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">Subscription Tiers</h3>
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <PlanCard plan={PLAN_DETAILS.Free} isCurrent={false} />
                    <PlanCard plan={PLAN_DETAILS.Pro} isCurrent={false} />
                    <PlanCard plan={PLAN_DETAILS.Enterprise} isCurrent={false} />
                </div>
            </section>
            
            <Card>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <Icon name="billing" className="w-6 h-6" />
                    Billing Cycle & Management
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                    The billing system operates on a recurring monthly cycle. Subscriptions are automatically renewed at the beginning of each billing period.
                    Organization Owners and Admins can manage their subscription, view invoices, and update payment methods through the 'Billing & Plan' page. The checkout process is simulated but designed to integrate with a payment processor like Stripe.
                </p>
            </Card>
            
            <Card>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <Icon name="slider" className="w-6 h-6" />
                    Feature Gating & Quotas
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Access to features and resource consumption is controlled based on the organization's subscription tier. This is a core principle of the SaaS model, allowing for scalable pricing. Key examples include:
                </p>
                <div className="space-y-2">
                    <FeatureGatingDetail feature="Monthly Log Ingestion" tiers="Quota-based" />
                    <FeatureGatingDetail feature="Team Members per Organization" tiers="Quota-based" />
                    <FeatureGatingDetail feature="AI Root Cause Analysis" tiers="Pro & Enterprise" />
                    <FeatureGatingDetail feature="AI Pattern Recognition" tiers="Pro & Enterprise" />
                    <FeatureGatingDetail feature="Audit Logs" tiers="Admin/Owner Only" />
                    <FeatureGatingDetail feature="Data Sources API Key Management" tiers="Admin/Owner Only" />
                    <FeatureGatingDetail feature="Priority Support" tiers="Enterprise Only" />
                </div>
            </Card>
            
            <Card>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <Icon name="users-group" className="w-6 h-6" />
                    Multi-Tenancy and Data Isolation
                </h3>
                 <p className="text-gray-600 dark:text-gray-400">
                    The backend is built with a multi-tenant architecture. Every piece of data, including logs, user profiles, and settings, is tied to an <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded-sm font-mono text-sm">organizationId</code>. All database queries are scoped to the currently authenticated user's organization, preventing any possibility of data leakage between tenants. This is enforced at the API level through JWT authentication and middleware.
                </p>
            </Card>

        </div>
    );
};

export default SaaSSubscription;