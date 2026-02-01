
import * as React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './ui/Icon';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useCommandPalette } from '../contexts/CommandPaletteContext';
import { developerAvatar } from '../assets/images';

interface SidebarProps {
  isMobileOpen: boolean;
  setMobileOpen: (isOpen: boolean) => void;
}

const CollapsibleSection: React.FC<{
  title: string;
  icon: string;
  children: React.ReactNode;
  paths: string[];
}> = ({ title, icon, children, paths }) => {
  const location = useLocation();
  const isActiveSection = paths.some(path => location.pathname.startsWith(path));
  const [isOpen, setIsOpen] = React.useState(isActiveSection);

  React.useEffect(() => {
    if(isActiveSection) {
      setIsOpen(true);
    }
  }, [isActiveSection])

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-all duration-200 text-left hover:bg-black/5 dark:hover:bg-white/5 ${
            isActiveSection 
            ? 'font-semibold text-gray-900 dark:text-white'
            : 'font-medium text-gray-700 dark:text-gray-300'
        }`}
      >
        <div className="flex items-center">
          <Icon name={icon} className="w-5 h-5 mr-3" />
          <span>{title}</span>
        </div>
        <Icon name="chevron-down" className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="mt-2 ml-4 pl-4 border-l border-gray-200 dark:border-gray-700 space-y-1">{children}</div>}
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, setMobileOpen }) => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { openPalette } = useCommandPalette();

  React.useEffect(() => {
    if (isMobileOpen) {
      setMobileOpen(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `sidebar-nav-link flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 relative ${
      isActive
        ? 'active-link bg-black/5 dark:bg-white/5 text-gray-900 dark:text-white font-semibold'
        : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white hover:translate-x-1'
    }`;
  
  const canAccessAdminPages = currentUser?.role === Role.OWNER || currentUser?.role === Role.SUPER_ADMIN || currentUser?.role === Role.ADMIN || currentUser?.role === Role.ANALYST;
  const isSuperAdmin = currentUser?.role === Role.SUPER_ADMIN;

  const analysisPaths = ["/dashboard", "/live-anomalies", "/log-explorer", "/live-tail", "/alert-history", "/pattern-recognition", "/learned-insights", "/incidents", "/dataset-lab"];
  const aiToolkitPaths = ["/ai-chat", "/visual-log-parser", "/live-object-detector"];
  const infraPaths = ["/container-insights"];
  const configPaths = ["/alerting", "/notifications", "/log-pipelines", "/proactive-insights", "/enterprise-connectors", "/settings", "/data-sources", "/audit-logs", "/billing", "/saas-subscription", "/roles-permissions", "/deployment-history", "/super-admin-panel"];

  return (
     <>
      {/* Overlay for mobile */}
      <div
        className={`fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity ${
          isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`fixed top-0 left-0 h-full w-64 flex-shrink-0 bg-white dark:bg-[#1C1C1E] border-r border-gray-200 dark:border-gray-800 p-4 flex flex-col z-40 transform transition-transform md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-2 mb-6 flex items-center justify-between">
          <div className="flex items-center">
            <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded-lg mr-3 animate-heartbeat">
              <Icon name="logo" className="w-6 h-6 text-gray-800 dark:text-gray-200" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 animate-heartbeat">Aether<span className="text-[var(--accent-color-gold)]">Log</span></h1>
          </div>
          <button
            onClick={openPalette}
            title="Open Command Palette (Cmd+K)"
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-md"
          >
            <Icon name="command" className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 custom-scrollbar">
          <CollapsibleSection title="Analysis" icon="dashboard" paths={analysisPaths}>
              <NavLink to="/dashboard" className={navLinkClasses}>Dashboard</NavLink>
              <NavLink to="/live-anomalies" className={navLinkClasses}>Live Anomalies</NavLink>
              <NavLink to="/live-tail" className={navLinkClasses}>Live Tail</NavLink>
              <NavLink to="/dataset-lab" className={navLinkClasses}>Dataset Lab</NavLink>
              <NavLink to="/incidents" className={navLinkClasses}>Incident Center</NavLink>
              <NavLink to="/log-explorer" className={navLinkClasses}>Log Explorer</NavLink>
              <NavLink to="/alert-center" className={navLinkClasses}>Alert Center+</NavLink>
              <NavLink to="/alert-history" className={navLinkClasses}>Alert History</NavLink>
              <NavLink to="/pattern-recognition" className={navLinkClasses}>Pattern Recognition</NavLink>
              <NavLink to="/learned-insights" className={navLinkClasses}>Learned Insights</NavLink>
          </CollapsibleSection>

           <CollapsibleSection title="AI Toolkit" icon="sparkles" paths={aiToolkitPaths}>
              <NavLink to="/ai-chat" className={navLinkClasses}>AI Chat</NavLink>
              <NavLink to="/visual-log-parser" className={navLinkClasses}>Visual Parser</NavLink>
              <NavLink to="/live-object-detector" className={navLinkClasses}>Object Detector</NavLink>
          </CollapsibleSection>

          <CollapsibleSection title="Infrastructure" icon="containers" paths={infraPaths}>
              <NavLink to="/container-insights" className={navLinkClasses}>Container Insights</NavLink>
          </CollapsibleSection>

          <CollapsibleSection title="Configuration" icon="settings" paths={configPaths}>
              <NavLink to="/alerting" className={navLinkClasses}>Alerting Rules</NavLink>
              <NavLink to="/notifications" className={navLinkClasses}>Notifications</NavLink>
              <NavLink to="/log-pipelines" className={navLinkClasses}>Log Pipelines</NavLink>
              {canAccessAdminPages && (
                <>
                  <NavLink to="/proactive-insights" className={navLinkClasses}>Proactive Insights</NavLink>
                  <NavLink to="/enterprise-connectors" className={navLinkClasses}>Enterprise Connectors</NavLink>
                  <NavLink to="/settings" className={navLinkClasses}>Org Settings</NavLink>
                  <NavLink to="/data-sources" className={navLinkClasses}>Data Sources</NavLink>
                  <NavLink to="/audit-logs" className={navLinkClasses}>Audit Logs</NavLink>
                  <NavLink to="/billing" className={navLinkClasses}>Billing & Plan</NavLink>
                  <NavLink to="/saas-subscription" className={navLinkClasses}>SaaS Model</NavLink>
                  <NavLink to="/roles-permissions" className={navLinkClasses}>Roles & Permissions</NavLink>
                  <NavLink to="/deployment-history" className={navLinkClasses}>Deployment History</NavLink>
                </>
              )}
              {isSuperAdmin && (
                  <NavLink to="/super-admin-panel" className={navLinkClasses}>Super Admin Panel</NavLink>
              )}
          </CollapsibleSection>
        </nav>

        <div className="mt-auto flex-shrink-0 pt-4 border-t border-gray-200 dark:border-gray-800">
           <div className="px-2 space-y-2">
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white transition-colors"
              >
                {theme === 'light' ? (
                  <>
                    <Icon name="moon" className="w-5 h-5" />
                    <span>Dark Mode</span>
                  </>
                ) : (
                  <>
                    <Icon name="sun" className="w-5 h-5" />
                    <span>Light Mode</span>
                  </>
                )}
              </button>
              {currentUser && (
                <div className="space-y-2">
                  <NavLink
                    to="/account"
                    className={({ isActive }) =>
                      `block p-3 rounded-lg transition-colors ${
                        isActive ? 'bg-gray-200/80 dark:bg-gray-700/80' : 'bg-gray-100/60 dark:bg-gray-800/60 hover:bg-gray-200/80 dark:hover:bg-gray-700/80'
                      }`
                    }
                  >
                    <div className="flex items-center">
                      <Icon name="user-circle" className="w-10 h-10 text-gray-500 dark:text-gray-400 mr-3" />
                      <div className="flex-1 overflow-hidden">
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{currentUser.username}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={`${currentUser.jobTitle} (${currentUser.role})`}>
                          {currentUser.jobTitle} ({currentUser.role})
                        </p>
                      </div>
                    </div>
                  </NavLink>
                  <button
                    onClick={logout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white transition-colors"
                  >
                    <Icon name="logout" className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
            <div className="p-2 mt-2">
              <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50 flex items-center justify-between">
                <div className="flex items-center">
                  <img src={developerAvatar} alt="Developer" className="w-10 h-10 rounded-full mr-3 object-cover" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Developed by</p>
                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">Abdelilah Agouni</p>
                  </div>
                </div>
                <a href="mailto:abdo.agouni@gmail.com" className="text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors" title="Email Developer">
                  <Icon name="envelope" className="w-6 h-6" />
                </a>
              </div>
            </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
