
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { SubscriptionPlan } from '../types';
import { Icon } from './ui/Icon';
import { useToast } from '../hooks/useToast';
import { createCheckoutSession } from '../services/paymentService';
import { useAuth } from '../contexts/AuthContext';

interface PaymentFormProps {
    planName: SubscriptionPlan;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ planName }) => {
    const [cardNumber, setCardNumber] = React.useState('');
    const [expiry, setExpiry] = React.useState('');
    const [cvc, setCvc] = React.useState('');
    const [cardName, setCardName] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const { showToast } = useToast();
    const { refetchContext } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        try {
            await createCheckoutSession(planName);
            await refetchContext();
            showToast(`Successfully upgraded to the ${planName} plan!`, 'success');
            navigate('/dashboard');
        } catch (err: any) {
            showToast(err.message || 'Payment failed. Please try again.', 'error');
            setIsLoading(false);
        }
    };
    
    const cardType = cardNumber.startsWith('4') ? 'visa' : cardNumber.startsWith('5') ? 'mastercard' : null;

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Payment Details</h3>
            
            <div>
                <label htmlFor="cardName" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Name on Card
                </label>
                <input id="cardName" type="text" value={cardName} onChange={e => setCardName(e.target.value)} required className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-300 dark:border-gray-600" />
            </div>
            
            <div>
                <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Card Number
                </label>
                <div className="relative">
                    <input id="cardNumber" type="text" value={cardNumber} onChange={e => setCardNumber(e.target.value)} placeholder="0000 0000 0000 0000" required className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600" />
                    {cardType && <Icon name={cardType} className="w-6 h-6 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="expiry" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                        Expiry Date
                    </label>
                    <input id="expiry" type="text" value={expiry} onChange={e => setExpiry(e.target.value)} placeholder="MM / YY" required className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-300 dark:border-gray-600" />
                </div>
                <div>
                    <label htmlFor="cvc" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                        CVC
                    </label>
                    <input id="cvc" type="text" value={cvc} onChange={e => setCvc(e.target.value)} placeholder="123" required className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-300 dark:border-gray-600" />
                </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 pt-2">
                This is a simulated payment form. No real transaction will occur.
            </p>

            <button type="submit" disabled={isLoading} className="w-full mt-4 py-3 px-4 rounded-lg font-semibold text-white transition-colors flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                {isLoading && <Icon name="loader" className="w-5 h-5 animate-spin" />}
                {isLoading ? 'Processing Payment...' : `Pay & Upgrade to ${planName}`}
            </button>
        </form>
    );
};

export default PaymentForm;
