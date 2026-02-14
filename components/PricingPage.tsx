import * as React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './ui/Icon';
import { PLAN_DETAILS, PlanCard } from './ui/PlanCard';
import { Role } from '../types';

const RoleDetail: React.FC<{ role: Role, description: string }> = ({ role, description }) => (
    <div className="p-4 bg-gray-100 dark:bg-gray-800/50 rounded-lg">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">{role}</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
    </div>
);

const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    return (
        <div className="border-b border-gray-200 dark:border-gray-700 py-4">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center text-left">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{q}</span>
                <Icon name="chevron-down" className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <p className="mt-2 text-gray-600 dark:text-gray-400">{a}</p>}
        </div>
    );
};

const PricingPage: React.FC = () => {
    return (
        <div className="min-h-screen">
             <header className="sticky top-0 bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-lg z-10 p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="container mx-auto flex justify-between items-center">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="p-1.5 bg-gray-200 dark:bg-gray-700 rounded-md"><Icon name="logo" className="w-6 h-6" /></div>
                        <span className="font-bold text-xl text-gray-900 dark:text-gray-100">Aether<span className="text-[var(--accent-color-gold)]">Log</span></span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link to="/login" className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white">Login</Link>
                        <Link to="/signup" className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm">Get Started</Link>
                    </div>
                </div>
            </header>
            
            <main className="container mx-auto px-4 py-16">
                <section className="text-center">
                     <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">Find the perfect plan</h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Start for free, then scale as you grow. All plans include our core AI analysis features.</p>
                </section>

                <section className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <PlanCard plan={PLAN_DETAILS.Free} isCurrent={false} />
                    <PlanCard plan={PLAN_DETAILS.Pro} isCurrent={false} />
                    <PlanCard plan={PLAN_DETAILS.Enterprise} isCurrent={false} />
                </section>
                
                <section className="mt-24">
                     <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-8">User Roles & Permissions</h2>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
                        <RoleDetail role={Role.MEMBER} description="Can view logs and dashboards. Cannot change any settings." />
                        <RoleDetail role={Role.ANALYST} description="A power user who can view all data, receive critical alerts, and contribute to the team's knowledge base by saving learned insights. Cannot change settings." />
                        <RoleDetail role={Role.ADMIN} description="Full access to manage organization settings, billing, and members (except the Owner)." />
                        <RoleDetail role={Role.OWNER} description="Has all Admin permissions and is the ultimate authority for the organization." />
                        <RoleDetail role={Role.SUPER_ADMIN} description="Platform administrator with access to all organizations and system-level settings." />
                     </div>
                </section>

                <section className="mt-24 max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-8">Frequently Asked Questions</h2>
                    <div className="space-y-2">
                        <FaqItem q="Can I change my plan later?" a="Yes, you can upgrade, downgrade, or cancel your plan at any time from the billing page within your account." />
                        <FaqItem q="What happens if I go over my log quota?" a="If you exceed your monthly log quota, ingestion will be paused until the start of the next billing cycle. We will notify you before this happens. You can upgrade your plan to continue ingesting logs without interruption." />
                        <FaqItem q="Do you offer discounts for non-profits or educational institutions?" a="Yes, we believe in supporting good causes. Please contact us for more information on our special pricing." />
                    </div>
                </section>
            </main>
        </div>
    );
};

export default PricingPage;