

import * as React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Icon } from './ui/Icon';
import { Role } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: Role[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { currentUser, isAuthLoading } = useAuth();
  
  if (isAuthLoading) {
    // Auth state is still loading from the backend
    return (
        <div className="flex items-center justify-center h-screen bg-transparent">
            <Icon name="loader" className="w-12 h-12 animate-spin text-blue-500" />
        </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  if (roles && roles.length > 0 && !roles.includes(currentUser.role)) {
    return <Navigate to="/dashboard" replace />;
  }


  return <>{children}</>;
};

export default ProtectedRoute;
