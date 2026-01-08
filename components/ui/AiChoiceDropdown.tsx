import * as React from 'react';
import { Icon } from './Icon';

interface AiChoice {
  label: string;
  provider: 'gemini' | 'openai' | 'python';
  action: (provider: 'gemini' | 'openai' | 'python') => void;
  disabled?: boolean;
  icon: string;
}

interface AiChoiceDropdownProps {
  choices: AiChoice[];
  isLoading?: boolean;
  onAction: (provider: 'gemini' | 'openai' | 'python') => void;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export const AiChoiceDropdown: React.FC<AiChoiceDropdownProps> = ({ choices, isLoading, onAction, children, className = '', size = 'md' }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const preferredChoice = choices.find(c => c.provider === 'openai' && !c.disabled) || choices.find(c => !c.disabled);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrimaryAction = () => {
    if (preferredChoice) {
        onAction(preferredChoice.provider);
    }
  };

  const handleChoiceAction = (choice: AiChoice) => {
    onAction(choice.provider);
    setIsOpen(false);
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
  };

  const hasAnyEnabled = choices.some(c => !c.disabled);
  const primaryDisabled = isLoading || !hasAnyEnabled || !preferredChoice;

  return (
    <div className={`relative inline-flex rounded-lg shadow-sm ${className}`} ref={dropdownRef}>
      <button
        type="button"
        className={`font-semibold transition-colors flex items-center gap-2 rounded-l-lg ${sizeClasses[size]} ${primaryDisabled ? 'bg-gray-400 dark:bg-gray-600 text-white cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
        onClick={handlePrimaryAction}
        disabled={primaryDisabled}
        title={!hasAnyEnabled ? 'No AI provider configured' : `Run with ${preferredChoice?.provider}`}
      >
        {isLoading && <Icon name="loader" className="w-4 h-4 animate-spin" />}
        {children}
      </button>
      <div className="relative">
        <button
          type="button"
          className={`inline-flex items-center p-2 rounded-r-lg border-l border-blue-700 transition-colors ${primaryDisabled ? 'bg-gray-400 dark:bg-gray-600 text-white cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          onClick={() => setIsOpen(!isOpen)}
          disabled={primaryDisabled}
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          <Icon name="chevron-down" className="w-4 h-4" />
        </button>
        {isOpen && (
          <div
            className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black dark:ring-gray-700 ring-opacity-5 z-20"
          >
            <div className="py-1" role="menu" aria-orientation="vertical">
              {choices.map(choice => (
                <button
                  key={choice.provider}
                  onClick={() => handleChoiceAction(choice)}
                  disabled={choice.disabled || isLoading}
                  className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  role="menuitem"
                >
                    <Icon name={choice.icon} className="w-5 h-5" />
                    <span>{choice.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
