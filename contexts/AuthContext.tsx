

import * as React from 'react';
import { User, Role, Organization } from '../types';
import * as authService from '../services/authService';
import { useToast } from '../hooks/useToast';

const JWT_TOKEN_KEY = 'jwt_token';
const FACE_ID_AUTOLOGIN_KEY = 'faceIdAutoLogin';

interface AuthContextType {
  currentUser: User | null;
  currentOrganization: Organization | null;
  organizationMembers: User[];
  token: string | null;
  isAuthLoading: boolean;
  login: (username: string, password: string) => Promise<User>;
  loginWithFaceId: (username: string) => Promise<User>;
  logout: () => void;
  signup: (username: string, email: string, password: string, organizationName: string, jobTitle: string) => Promise<User>;
  updateUser: (userId: string, updates: Partial<Pick<User, 'notificationEmail' | 'phone'>>) => Promise<void>;
  inviteMember: (email: string, role: Role) => Promise<User>;
  updateMemberRole: (userId: string, role: Role) => void;
  removeMember: (userId: string) => Promise<void>;
  refetchContext: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [currentOrganization, setCurrentOrganization] = React.useState<Organization | null>(null);
  const [organizationMembers, setOrganizationMembers] = React.useState<User[]>([]);
  const [token, setToken] = React.useState<string | null>(localStorage.getItem(JWT_TOKEN_KEY));
  const [isAuthLoading, setIsAuthLoading] = React.useState(true);
  const { showToast } = useToast();

  const fetchFullContext = React.useCallback(async (token: string) => {
    try {
      const { user, organization, members } = await authService.fetchFullContext(token);
      setCurrentUser(user);
      setCurrentOrganization(organization);
      setOrganizationMembers(members);
    } catch (error) {
      console.error('Failed to fetch session:', error);
      localStorage.removeItem(JWT_TOKEN_KEY);
      setCurrentUser(null);
      setCurrentOrganization(null);
      setOrganizationMembers([]);
    }
  }, []);

  const refetchContext = React.useCallback(async () => {
    const token = localStorage.getItem(JWT_TOKEN_KEY);
    if (token) {
      await fetchFullContext(token);
    }
  }, [fetchFullContext]);

  React.useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem(JWT_TOKEN_KEY);
      if (token) {
        await fetchFullContext(token);
      }
      setIsAuthLoading(false);
    };
    checkSession();
  }, [fetchFullContext]);

  const login = async (username: string, password: string): Promise<User> => {
    const { token, user } = await authService.login(username, password);
    localStorage.setItem(JWT_TOKEN_KEY, token);
    setToken(token);
    await fetchFullContext(token);
    return user;
  };

  const loginWithFaceId = async (username: string): Promise<User> => {
    const { token, user } = await authService.loginWithFaceId(username);
    localStorage.setItem(JWT_TOKEN_KEY, token);
    setToken(token);
    await fetchFullContext(token);
    return user;
  };

  const signup = async (username: string, email: string, password: string, organizationName: string, jobTitle: string): Promise<User> => {
    // Signup no longer automatically logs the user in.
    const { user } = await authService.signup(username, email, password, organizationName, jobTitle);
    return user;
  };

  const logout = () => {
    setCurrentUser(null);
    setCurrentOrganization(null);
    setOrganizationMembers([]);
    setToken(null);
    localStorage.removeItem(JWT_TOKEN_KEY);
    localStorage.removeItem(FACE_ID_AUTOLOGIN_KEY);
  };

  const updateUser = async (userId: string, updates: Partial<Pick<User, 'notificationEmail' | 'phone'>>) => {
    try {
      const token = localStorage.getItem(JWT_TOKEN_KEY);
      if(!token) throw new Error("Authentication error.");

      await authService.updateUser(token, updates);
      // After a successful API call, refetch context to ensure data is in sync
      await fetchFullContext(token);
    } catch (error: any) {
        showToast(error.message, 'error');
        throw error;
    }
  };

  const inviteMember = async (email: string, role: Role): Promise<User> => {
    try {
        // This feature is not implemented on the backend yet.
        const newUser = await authService.inviteMember(email, role);
        const token = localStorage.getItem(JWT_TOKEN_KEY);
        if(token) await fetchFullContext(token);
        return newUser;
    } catch (error: any) {
        showToast(error.message, 'info');
        throw error;
    }
  };

  const updateMemberRole = async (userId: string, role: Role) => {
     try {
        // This feature is not implemented on the backend yet.
        await authService.updateMemberRole(userId, role);
        const token = localStorage.getItem(JWT_TOKEN_KEY);
        if(token) await fetchFullContext(token);
    } catch (error: any) {
        showToast(error.message, 'info');
    }
  };

  const removeMember = async (userId: string): Promise<void> => {
     try {
        // This feature is not implemented on the backend yet.
        await authService.removeMember(userId);
        const token = localStorage.getItem(JWT_TOKEN_KEY);
        if(token) await fetchFullContext(token);
    } catch (error: any) {
        showToast(error.message, 'info');
        throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, currentOrganization, organizationMembers, token, isAuthLoading, login, loginWithFaceId, logout, signup, updateUser, inviteMember, updateMemberRole, removeMember, refetchContext }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
