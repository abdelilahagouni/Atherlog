
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlanDetails, SubscriptionPlan } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

export const PLAN_DETAILS: Record<SubscriptionPlan, PlanDetails> = {
    Free: {
        name: 'Free',
        price: '$0 / month',
        quotas: { logsPerMonth: 10000, members: 3 },
        features: ['10,000 Log Events/Month', '3 Team Members', 'Basic Anomaly Detection', 'Community Support'],
    },
    Pro: {
        name: 'Pro',
        price: '$99 / month',
        quotas: { logsPerMonth: 100000, members: 10 },
        features: ['100,000 Log Events/Month', '10 Team Members', 'Advanced Anomaly Detection', 'Email & Chat Support'],
    },
    Enterprise: {
        name: 'Enterprise',
        price: 'Custom',
        quotas: { logsPerMonth: 1000000, members: Infinity },
        features: ['Unlimited Log Events', 'Unlimited Members', 'Dedicated Infrastructure', '24/7 Priority Support'],
    },
};

export const PlanCard: React.FC<{ plan: PlanDetails, isCurrent: boolean }> = ({ plan, isCurrent }) => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const cardClasses = `border-2 rounded-xl p-6 flex flex-col h-full text-left ${
        isCurrent ? 'border-blue-500 bg-blue-500/5 dark:bg-blue-500/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C1C1E]'
    }`;
    
    const handleButtonClick = () => {
        if (isCurrent) return;

        if (plan.name === 'Enterprise') {
            window.location.href = 'mailto:sales@example.com?subject=Enterprise Plan Inquiry';
            return;
        }

        if (currentUser) {
            // Logged-in user is upgrading
            navigate(`/payment?plan=${plan.name}`);
        } else {
            // Logged-out user is choosing a plan
            navigate('/signup');
        }
    };
    
    let buttonText = 'Choose Plan';
    if (isCurrent) {
        buttonText = 'Current Plan';
    } else if (currentUser) {
        buttonText = plan.name === 'Enterprise' ? 'Contact Sales' : 'Upgrade';
    }

    return (
        <div className={cardClasses}>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{plan.name}</h3>
            <p className="text-lg font-semibold text-gray-600 dark:text-gray-300 mt-2">{plan.price}</p>
            <ul className="space-y-3 mt-6 text-gray-600 dark:text-gray-300 flex-grow">
                {plan.features.map(feature => (
                    <li key={feature} className="flex items-start">
                        <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>
             <button
                onClick={handleButtonClick}
                disabled={isCurrent}
                className="w-full mt-8 py-2 px-4 rounded-lg font-semibold text-white transition-colors disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600"
            >
                {buttonText}
            </button>
        </div>
    );
};