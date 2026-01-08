
import * as React from 'react';
import { useSearchParams, Navigate, Link } from 'react-router-dom';
import { SubscriptionPlan } from '../types';
import { PLAN_DETAILS } from './ui/PlanCard';
import { Card } from './ui/Card';
import { Icon } from './ui/Icon';
import PaymentForm from './PaymentForm';

const PaymentPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const planName = searchParams.get('plan') as SubscriptionPlan | null;

    if (!planName || !Object.keys(PLAN_DETAILS).includes(planName)) {
        return <Navigate to="/billing" replace />;
    }

    const plan = PLAN_DETAILS[planName];

    return (
        <div className="max-w-4xl mx-auto">
             <div className="mb-8 text-center">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Secure Checkout</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">You're upgrading to the <span className="font-bold text-blue-600 dark:text-blue-400">{plan.name}</span> plan.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {/* Order Summary */}
                <Card>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Order Summary</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600 dark:text-gray-300">Plan:</span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{plan.name}</span>
                        </div>
                         <div className="flex justify-between items-center">
                            <span className="text-gray-600 dark:text-gray-300">Price:</span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{plan.price}</span>
                        </div>
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                             <div className="flex justify-between items-center text-lg">
                                <span className="font-bold text-gray-900 dark:text-gray-100">Total Due Today:</span>
                                <span className="font-bold text-gray-900 dark:text-gray-100">${plan.price.split(' ')[0].replace('$', '')}</span>
                            </div>
                        </div>
                    </div>
                    <ul className="space-y-3 mt-8 text-gray-600 dark:text-gray-300 text-sm">
                        {plan.features.map(feature => (
                            <li key={feature} className="flex items-start">
                                <Icon name="check-circle" className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                </Card>

                {/* Payment Form */}
                <Card>
                    <PaymentForm planName={planName} />
                </Card>
            </div>
            <div className="text-center mt-8">
                <Link to="/billing" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    &larr; Back to Billing
                </Link>
            </div>
        </div>
    );
};

export default PaymentPage;
