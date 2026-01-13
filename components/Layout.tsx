import * as React from 'react';
import Sidebar from './Sidebar';
import { Icon } from './ui/Icon';
import CommandPalette from './CommandPalette';
import { useCommandPalette } from '../contexts/CommandPaletteContext';
import ApiStatusBanner from './ApiStatusBanner';
import HamburgerMenu from './ui/HamburgerMenu';
import BottomNavigation from './ui/BottomNavigation';

interface LayoutProps {
  children: React.ReactNode;
}

import PullToRefresh from './ui/PullToRefresh';

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setSidebarOpen] = React.useState(false);
  const { openPalette } = useCommandPalette();

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        openPalette();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openPalette]);

  const handleRefresh = async () => {
    // Simulate a refresh delay and reload the page to fetch fresh data
    await new Promise(resolve => setTimeout(resolve, 1000));
    window.location.reload();
  };

  return (
    <div className="flex h-screen bg-transparent relative overflow-hidden">
      <Sidebar isMobileOpen={isSidebarOpen} setMobileOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col md:ml-64">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-[#1C1C1E] border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <HamburgerMenu isOpen={isSidebarOpen} onClick={() => setSidebarOpen(!isSidebarOpen)} />
          <div className="flex items-center">
            <div className="p-1.5 bg-gray-200 dark:bg-gray-700 rounded-md mr-2 animate-heartbeat">
              <Icon name="logo" className="w-5 h-5 text-gray-800 dark:text-gray-200" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 animate-heartbeat">Aether<span className="text-[var(--accent-color-gold)]">Log</span></h1>
          </div>
          <div className="w-8" /> {/* Spacer to balance the hamburger menu button */}
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-8 relative" id="main-content">
          <PullToRefresh onRefresh={handleRefresh}>
            <div className="p-4 sm:p-6 lg:p-8 min-h-full">
              <ApiStatusBanner />
              {children}
            </div>
          </PullToRefresh>
        </main>
        
        {/* Bottom Navigation for Mobile */}
        <BottomNavigation />
      </div>
      <CommandPalette />
    </div>
  );
};

export default Layout;