import { Role, User, Organization } from '../types';

import { API_BASE_URL } from '../utils/config';

export const handleResponse = async (response: Response) => {
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        data = { message: text || `HTTP error! status: ${response.status}` };
    }

    if (!response.ok) {
        const error = new Error(data.message || `HTTP error! status: ${response.status}`);
        (error as any).status = response.status;
        Object.assign(error, data);
        throw error;
    }
    return data;
};

export const login = async (username: string, password: string): Promise<{ token: string, user: User }> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    return handleResponse(response);
};

// This function is for the frontend Face ID *simulation*. The backend doesn't have a real Face ID endpoint.
// For this to work, we'll simulate it by calling the regular login endpoint.
// The backend is seeded with 'superadmin'/'superadmin'. For new users, this will only work if password matches username.
export const loginWithFaceId = async (username: string): Promise<{ token: string, user: User }> => {
    // We assume the password is the same as the username for the demo, with a special case for the default admin
    const password = username === 'superadmin' ? 'superadmin' : username;
     return login(username, password);
};


export const signup = async (username: string, email: string, password: string, organizationName: string, jobTitle: string): Promise<{ user: User }> => {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, organizationName, jobTitle }),
    });
    return handleResponse(response);
};

export const verifyEmailToken = async (token: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
    });
    return handleResponse(response);
};

export const resendVerificationLink = async (usernameOrEmail: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail }),
    });
    await handleResponse(response);
};

export const fetchFullContext = async (token: string): Promise<{ user: User, organization: Organization, members: User[] }> => {
     const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse(response);
};

export const getAllUsersForSuperAdmin = async (): Promise<(User & { organizationName: string })[]> => {
    const token = localStorage.getItem('jwt_token');
    if (!token) throw new Error("Authentication error.");
    const response = await fetch(`${API_BASE_URL}/organization/all-users`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse(response);
}

export const updateUser = async (token: string, updates: Partial<Pick<User, 'notificationEmail' | 'phone'>>): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'PATCH',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
    });
    return handleResponse(response);
};

// --- The following functions do not have backend endpoints yet and are gracefully disabled ---
// In a real application, you would implement these routes in your Express backend.

export const inviteMember = async (email: string, role: Role): Promise<User> => {
    // Placeholder - A real implementation would make a POST request to /api/organization/invites
     throw new Error("Inviting members is not yet supported by the backend.");
};

export const updateMemberRole = async (userId: string, role: Role) => {
    // Placeholder - A real implementation would make a PATCH request to /api/organization/members/{userId}
     throw new Error("Updating member roles is not yet supported by the backend.");
};

export const removeMember = async (userId: string) => {
    // Placeholder - A real implementation would make a DELETE request to /api/organization/members/{userId}
     throw new Error("Removing members is not yet supported by the backend.");
};

export const forgotPassword = async (username: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
    });
    await handleResponse(response);
};

export const resetPassword = async (token: string, newPassword: string): Promise<void> => {
     const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
    });
    await handleResponse(response);
};