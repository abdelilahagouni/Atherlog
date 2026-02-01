
import * as React from 'react';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { SettingsProvider } from './contexts/SettingsContext';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';
import SignUp from './components/SignUp';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastProvider } from './contexts/ToastContext';
import ForgotPassword from './components/ForgotPassword';
import { Role } from './types';
import ResetPassword from './components/ResetPassword';
import { ThemeProvider } from './contexts/ThemeContext';
import { CommandPaletteProvider } from './contexts/CommandPaletteContext';
import EmailVerificationPage from './components/EmailVerificationPage';
import ResendVerificationPage from './components/ResendVerificationPage';
import LandingPage from './components/LandingPage';
import { Icon } from './components/ui/Icon';
import PricingPage from './components/PricingPage';
import AboutPage from './components/AboutPage';
import { soundNotificationService } from './services/soundNotificationService';

// Lazy load components for code splitting
const Dashboard = lazy(() => import('./components/Dashboard'));
const LiveAnomalies = lazy(() => import('./components/LiveAnomalies'));
const LogExplorer = lazy(() => import('./components/LogExplorer'));
const AlertHistory = lazy(() => import('./components/AlertHistory'));
const VisualLogParser = lazy(() => import('./components/VisualLogParser'));
const LiveObjectDetector = lazy(() => import('./components/LiveObjectDetector'));
const PatternRecognition = lazy(() => import('./components/PatternRecognition'));
const LearnedInsights = lazy(() => import('./components/LearnedInsights'));
const AIChat = lazy(() => import('./components/AIChat'));
const ContainerInsights = lazy(() => import('./components/ContainerInsights'));
const Alerting = lazy(() => import('./components/Alerting'));
const Notifications = lazy(() => import('./components/Notifications'));
const Settings = lazy(() => import('./components/Settings'));
const DataSources = lazy(() => import('./components/DataSources'));
const AuditLogs = lazy(() => import('./components/AuditLogs'));
const Billing = lazy(() => import('./components/Billing'));
const SuperAdminPanel = lazy(() => import('./components/SuperAdminPanel'));
const MyAccount = lazy(() => import('./components/MyAccount'));
const PaymentPage = lazy(() => import('./components/PaymentPage'));
const SaaSSubscription = lazy(() => import('./components/SaaSSubscription'));
const IncidentCenter = lazy(() => import('./components/IncidentCenter'));
const IncidentDetail = lazy(() => import('./components/IncidentDetail'));
const RolesAndPermissions = lazy(() => import('./components/RolesAndPermissions'));
const DeploymentHistory = lazy(() => import('./components/DeploymentHistory'));
const ProactiveInsights = lazy(() => import('./components/ProactiveInsights'));
const DatasetLaboratory = lazy(() => import('./components/DatasetLaboratory'));
const EnterpriseConnectors = lazy(() => import('./components/EnterpriseConnectors'));
const AlertCenterPlus = lazy(() => import('./components/AlertCenterPlus'));
const LiveTail = lazy(() => import('./components/LiveTail'));
const PipelineManager = lazy(() => import('./components/PipelineManager'));

const SuspenseFallback: React.FC = () => (
  <div className="flex items-center justify-center h-full w-full">
    <Icon name="loader" className="w-10 h-10 animate-spin text-blue-500" />
  </div>
);


const App: React.FC = () => {
  return (
      <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <CommandPaletteProvider>
            <SettingsProvider>
                <HashRouter>
                  <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/pricing" element={<PricingPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<SignUp />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/verify-email" element={<EmailVerificationPage />} />
                    <Route path="/resend-verification" element={<ResendVerificationPage />} />
                    <Route
                      path="/*"
                      element={
                        <ProtectedRoute>
                          <Layout>
                            <Suspense fallback={<SuspenseFallback />}>
                              <Routes>
                                <Route path="/dashboard" element={<Dashboard />} />
                                <Route path="/live-anomalies" element={<LiveAnomalies />} />
                                <Route path="/log-explorer" element={<LogExplorer />} />
                                <Route path="/live-tail" element={<LiveTail />} />
                                <Route path="/alert-history" element={<AlertHistory />} />
                                <Route path="/alert-center" element={<AlertCenterPlus />} />
                                <Route path="/visual-log-parser" element={<VisualLogParser />} />
                                <Route path="/live-object-detector" element={<LiveObjectDetector />} />
                                <Route path="/pattern-recognition" element={<PatternRecognition />} />
                                <Route path="/learned-insights" element={<LearnedInsights />} />
                                <Route path="/ai-chat" element={<AIChat />} />
                                <Route path="/container-insights" element={<ContainerInsights />} />
                                <Route path="/alerting" element={<Alerting />} />
                                <Route path="/notifications" element={<Notifications />} />
                                <Route path="/incidents" element={<IncidentCenter />} />
                                <Route path="/incidents/:id" element={<IncidentDetail />} />
                                <Route path="/log-pipelines" element={<PipelineManager />} />
                                <Route path="/dataset-lab" element={<DatasetLaboratory />} />
                                <Route 
                                  path="/settings" 
                                  element={
                                    <ProtectedRoute roles={[Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.ANALYST]}>
                                      <Settings />
                                    </ProtectedRoute>
                                  } 
                                />
                                <Route 
                                  path="/data-sources" 
                                  element={
                                    <ProtectedRoute roles={[Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.ANALYST]}>
                                      <DataSources />
                                    </ProtectedRoute>
                                  } 
                                />
                                <Route 
                                  path="/audit-logs" 
                                  element={
                                    <ProtectedRoute roles={[Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.ANALYST]}>
                                      <AuditLogs />
                                    </ProtectedRoute>
                                  } 
                                />
                                <Route 
                                  path="/billing" 
                                  element={
                                    <ProtectedRoute roles={[Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.ANALYST]}>
                                      <Billing />
                                    </ProtectedRoute>
                                  } 
                                />
                                <Route 
                                  path="/super-admin-panel" 
                                  element={
                                    <ProtectedRoute roles={[Role.SUPER_ADMIN]}>
                                      <SuperAdminPanel />
                                    </ProtectedRoute>
                                  } 
                                />
                                <Route path="/account" element={<MyAccount />} />
                                <Route path="/payment" element={<PaymentPage />} />
                                <Route 
                                  path="/saas-subscription" 
                                  element={
                                    <ProtectedRoute roles={[Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.ANALYST]}>
                                      <SaaSSubscription />
                                    </ProtectedRoute>
                                  } 
                                />
                                 <Route 
                                  path="/roles-permissions" 
                                  element={
                                    <ProtectedRoute roles={[Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.ANALYST]}>
                                      <RolesAndPermissions />
                                    </ProtectedRoute>
                                  } 
                                />
                                 <Route 
                                  path="/deployment-history" 
                                  element={
                                    <ProtectedRoute roles={[Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.ANALYST]}>
                                      <DeploymentHistory />
                                    </ProtectedRoute>
                                  } 
                                />
                                <Route 
                                  path="/proactive-insights" 
                                  element={
                                    <ProtectedRoute roles={[Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.ANALYST]}>
                                      <ProactiveInsights />
                                    </ProtectedRoute>
                                  } 
                                />
                                <Route 
                                  path="/enterprise-connectors" 
                                  element={
                                    <ProtectedRoute roles={[Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.ANALYST]}>
                                      <EnterpriseConnectors />
                                    </ProtectedRoute>
                                  } 
                                />
                              </Routes>
                            </Suspense>
                          </Layout>
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                </HashRouter>
            </SettingsProvider>
          </CommandPaletteProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
