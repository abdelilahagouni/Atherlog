// Required secrets. There are NO hard-coded fallbacks: the backend refuses to start without them.
//   JWT_SECRET        required, at least 32 characters (signs login, verification and reset tokens)
//   POSTGRES_PASSWORD required unless DATABASE_URL is set
export const JWT_SECRET_MIN_LENGTH = 32;

export const getJwtSecret = (): string => {
    const v = process.env.JWT_SECRET;
    if (!v || v.trim().length < JWT_SECRET_MIN_LENGTH) {
        throw new Error(`[CONFIG] JWT_SECRET is ${!v ? 'missing' : `too short (${v.trim().length} characters)`}; ` +
                        `it must be at least ${JWT_SECRET_MIN_LENGTH} characters.`);
    }
    return v;
};

export const getPostgresPassword = (): string => {
    const v = process.env.POSTGRES_PASSWORD;
    if (!v) throw new Error('[CONFIG] POSTGRES_PASSWORD is missing (or set DATABASE_URL instead).');
    return v;
};

/** Called once at startup, before any route or service is loaded. Prints a clear message and exits on error. */
export const validateRequiredSecretsOrExit = (): void => {
    const problems: string[] = [];
    try { getJwtSecret(); } catch (e: any) { problems.push(e.message); }
    if (!process.env.DATABASE_URL) {
        try { getPostgresPassword(); } catch (e: any) { problems.push(e.message); }
    }
    if (problems.length) {
        console.error('\n' + '='.repeat(78));
        console.error('BACKEND NOT STARTED - required secret configuration is missing or too weak:');
        for (const p of problems) console.error('  - ' + p);
        console.error('Set the value(s) in backend/.env (see backend/.env.example). Example to generate a JWT secret:');
        console.error('  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"');
        console.error('='.repeat(78) + '\n');
        process.exit(1);
    }
};
