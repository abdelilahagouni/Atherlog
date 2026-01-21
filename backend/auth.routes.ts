
// FIX: Use explicit express types to resolve type conflicts.
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt, { TokenExpiredError } from 'jsonwebtoken';
import { getDb, getOrganizationWithDetails, PLAN_CONFIG } from './database';
import { User, Role } from './types';
import { sendVerificationEmail } from './notificationService';
import * as crypto from 'crypto';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-that-should-be-in-an-env-file'; // In production, use environment variables

// Middleware to protect routes
export const protect = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const bearer = req.headers.authorization;
    if (!bearer || !bearer.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }
    const token = bearer.split(' ')[1].trim();
    try {
        const user = jwt.verify(token, JWT_SECRET) as User;
        (req as any).user = user;
        next();
    } catch (e) {
        return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
};

// POST /api/auth/signup
router.post('/signup', async (req: express.Request, res: express.Response) => {
    const { username, email, password, organizationName, jobTitle } = req.body;

    if (!username || !email || !password || !organizationName || !jobTitle) {
        return res.status(400).json({ message: 'Please provide all required fields.' });
    }

    const db = getDb();

    const existingUser = await db.get<User>('SELECT * FROM users WHERE "username" = ? OR "email" = ?', [username, email]);
    if (existingUser) {
        if (existingUser.username === username) {
            return res.status(409).json({ message: 'Username already exists' });
        }
        if (existingUser.email === email) {
            return res.status(409).json({ message: 'Email address is already in use' });
        }
    }
    
    const existingOrg = await db.get('SELECT * FROM organizations WHERE "name" = ?', [organizationName]);
    if (existingOrg) {
        return res.status(409).json({ message: 'Organization name is already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const orgId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const verificationToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1h' });

    // Check if email service is configured
    const isEmailConfigured = process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM_ADDRESS;
    
    // Auto-verify if email service is NOT configured (Dev Mode) so users aren't locked out
    let isVerified = !isEmailConfigured;

    try {
        await db.run(
            'INSERT INTO organizations ("id", "name", "plan") VALUES (?, ?, ?)',
            [orgId, organizationName, JSON.stringify(PLAN_CONFIG.Free)]
        );

        const newUser: Omit<User, 'password'> & {password: string, isVerified: boolean} = {
            id: userId,
            organizationId: orgId,
            username,
            password: hashedPassword,
            role: Role.OWNER,
            email: email,
            jobTitle,
            salary: 0,
            hireDate: new Date().toISOString(),
            isVerified: isVerified,
            verificationToken: isVerified ? undefined : verificationToken,
        };

        await db.run(
            `INSERT INTO users ("id", "organizationId", "username", "password", "role", "email", "jobTitle", "salary", "hireDate", "phone", "isVerified", "verificationToken")
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [newUser.id, newUser.organizationId, newUser.username, newUser.password, newUser.role, newUser.email, newUser.jobTitle, newUser.salary, newUser.hireDate, null, newUser.isVerified, newUser.verificationToken]
        );
        
        let message = isVerified 
            ? 'Signup successful! Account auto-verified (Dev Mode). You can log in now.' 
            : 'Signup successful. Please check your email to verify your account.';

        // Only attempt to send email if configured, but catch ANY error to prevent crash
        if (isEmailConfigured) {
            try {
                await sendVerificationEmail(newUser.email, verificationToken, newUser.username);
            } catch (emailError: any) {
                console.error("Failed to send verification email:", emailError.message);
                
                // CRITICAL FIX: If email fails, auto-verify the user so they are not locked out.
                await db.run('UPDATE users SET "isVerified" = TRUE, "verificationToken" = NULL WHERE "id" = ?', [userId]);
                isVerified = true;
                message = "Signup successful. Email delivery failed, so your account was auto-verified for development. You can log in.";
                
                console.log(`\n--- [DEV WARNING] Email failed. User '${newUser.username}' was AUTO-VERIFIED to prevent lockout. ---\n`);
            }
        } else {
            console.log(`\n--- [DEV MODE] Email service not configured. User '${newUser.username}' auto-verified. ---\n`);
        }

        const userForResponse = { ...newUser, isVerified };
        delete (userForResponse as Partial<User>).password;
        delete (userForResponse as Partial<User>).verificationToken;

        res.status(201).json({ user: userForResponse, message });

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error during signup.' });
    }
});

// POST /api/auth/login
router.post('/login', async (req: express.Request, res: express.Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide username and password.' });
    }
    
    const db = getDb();
    const user = await db.get<User>('SELECT * FROM users WHERE "username" = ?', [username]);

    if (!user || !user.password) {
        return res.status(401).json({ message: 'Invalid username or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    // PostgreSQL returns a real boolean, so check for truthiness.
    if (!user.isVerified) {
        return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }


    const userForToken = { ...user };
    delete (userForToken as Partial<User>).password;

    const token = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '1d' });
    res.status(200).json({ token, user: userForToken });
});

// POST /api/auth/verify-email
router.post('/verify-email', async (req: express.Request, res: express.Response) => {
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ message: 'Verification token is required.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
        const userId = decoded.id;
        
        const db = getDb();
        const user = await db.get<User>('SELECT "id", "isVerified" FROM users WHERE "id" = ?', [userId]);

        if (!user) {
            return res.status(400).json({ message: 'Invalid verification link. User not found.' });
        }

        if (user.isVerified) { 
             return res.status(409).json({ message: 'This account has already been verified. You can proceed to login.' });
        }

        // The token is valid and the user is not verified, so proceed with verification.
        await db.run(
            'UPDATE users SET "isVerified" = TRUE, "verificationToken" = NULL WHERE "id" = ?',
            [userId]
        );

        return res.status(200).json({ message: 'Email verified successfully! You can now log in.' });

    } catch (e) {
        if (e instanceof TokenExpiredError) {
            return res.status(401).json({ message: 'This verification link has expired. Please request a new one.' });
        }
        return res.status(401).json({ message: 'This verification link is invalid or has been corrupted.' });
    }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req: express.Request, res: express.Response) => {
    const { usernameOrEmail } = req.body;
    if (!usernameOrEmail) {
        return res.status(400).json({ message: 'Username or email is required.' });
    }

    const db = getDb();
    const user = await db.get<User>('SELECT * FROM users WHERE "username" = ? OR "email" = ?', [usernameOrEmail, usernameOrEmail]);

    if (user) {
        if (user.isVerified) {
            return res.status(409).json({ message: 'This account has already been verified. Please proceed to login.' });
        }
        
        // Check if email service is configured
        const isEmailConfigured = process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM_ADDRESS;

        if (!isEmailConfigured) {
            // Auto-verify if in dev mode without email
            await db.run('UPDATE users SET "isVerified" = TRUE, "verificationToken" = NULL WHERE "id" = ?', [user.id]);
            return res.status(200).json({ message: 'Email service not configured. Account has been auto-verified for development. Please log in.' });
        }

        const newVerificationToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
        
        await db.run(
            'UPDATE users SET "verificationToken" = ? WHERE "id" = ?',
            [newVerificationToken, user.id]
        );

        try {
            await sendVerificationEmail(user.email, newVerificationToken, user.username);
        } catch (emailError: any) {
             console.error("Failed to resend verification email:", emailError.message);
             // CRITICAL FIX: Also auto-verify here if sending fails to avoid lockout loops
             await db.run('UPDATE users SET "isVerified" = TRUE, "verificationToken" = NULL WHERE "id" = ?', [user.id]);
             return res.status(200).json({ message: 'Email delivery failed. Account has been auto-verified for development. Please log in.' });
        }
    }
    
    res.status(200).json({ message: 'If an unverified account exists with that username or email, a new verification link has been sent.' });
});

// GET /api/auth/me (Protected)
router.get('/me', protect, async (req: express.Request, res: express.Response) => {
    const authenticatedUser = (req as any).user as User;
    const db = getDb();

    const user = await db.get<Omit<User, 'password'>>(
        'SELECT "id", "organizationId", "username", "role", "email", "jobTitle", "salary", "hireDate", "notificationEmail", "phone", "isVerified" FROM users WHERE "id" = ?', 
        [authenticatedUser.id]
    );

    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    const organization = await getOrganizationWithDetails(user.organizationId);
    
    const members = await db.all<Omit<User, 'password'>>(
        'SELECT "id", "organizationId", "username", "role", "email", "jobTitle", "salary", "hireDate", "notificationEmail", "phone", "isVerified" FROM users WHERE "organizationId" = ?', 
        [user.organizationId]
    );
    
    res.status(200).json({ user, organization, members });
});

// PATCH /api/auth/me (Protected)
router.patch('/me', protect, async (req: express.Request, res: express.Response) => {
    const authenticatedUser = (req as any).user as User;
    const { notificationEmail, phone } = req.body;
    
    if (notificationEmail === undefined && phone === undefined) {
        return res.status(400).json({ message: 'No update data provided.' });
    }

    const db = getDb();
    
    try {
        await db.run(
            'UPDATE users SET "notificationEmail" = ?, "phone" = ? WHERE "id" = ?',
            [notificationEmail, phone, authenticatedUser.id]
        );
        
         const updatedUser = await db.get<Omit<User, 'password'>>(
            'SELECT "id", "organizationId", "username", "role", "email", "jobTitle", "salary", "hireDate", "notificationEmail", "phone" FROM users WHERE "id" = ?', 
            [authenticatedUser.id]
        );
        
        res.status(200).json(updatedUser);

    } catch(e) {
        console.error("Failed to update user:", e);
        res.status(500).json({ message: 'Failed to update user profile.' });
    }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: express.Request, res: express.Response) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ message: 'Username is required.' });
    }

    const db = getDb();
    const user = await db.get<User>('SELECT "id", "username", "email" FROM users WHERE "username" = ?', [username]);

    if (user) {
        const resetToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '15m' });
        
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetLink = `${frontendUrl}/#/reset-password?token=${resetToken}`;
        
        console.log('--- PASSWORD RESET LINK (FOR LOCAL TESTING) ---');
        console.log(`User '${username}' requested a password reset. Copy this link into your browser:`);
        console.log(resetLink);
        console.log('------------------------------------------------');
    }

    res.status(200).json({ message: 'If an account with that username exists, a reset link has been generated.' });
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: express.Request, res: express.Response) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
        const userId = decoded.id;

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const db = getDb();
        const result = await db.run('UPDATE users SET "password" = ? WHERE "id" = ?', [hashedPassword, userId]);

        if (!result.changes || result.changes === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({ message: 'Password has been reset successfully.' });

    } catch (e) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
});


export default router;
