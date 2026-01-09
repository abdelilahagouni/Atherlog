import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Icon } from './Icon';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

const BottomNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
    { path: '/live-anomalies', icon: 'anomaly', label: 'Anomalies' },
    { path: '/ai-chat', icon: 'sparkles', label: 'AI Chat' },
    { path: '/notifications', icon: 'bell', label: 'Alerts' },
    { path: '/account', icon: 'user-circle', label: 'Account' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1C1C1E] border-t border-gray-200 dark:border-gray-800 z-50 bottom-nav">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center flex-1 h-full touch-feedback transition-colors ${
              isActive(item.path)
                ? 'text-[var(--accent-color-gold)]'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <Icon
              name={item.icon}
              className={`w-6 h-6 mb-1 transition-transform ${
                isActive(item.path) ? 'scale-110' : ''
              }`}
            />
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNavigation;
