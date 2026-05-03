/** Password rules for partner registration and changing password (must stay in sync). */

export type PasswordPolicyChecks = {
    minLength: boolean;
    uppercase: boolean;
    lowercase: boolean;
    special: boolean;
};

export function getPasswordPolicyChecks(password: string): PasswordPolicyChecks {
    return {
        minLength: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    };
}

export function isPasswordPolicyValid(password: string): boolean {
    return Object.values(getPasswordPolicyChecks(password)).every(Boolean);
}

export const PASSWORD_POLICY_ERROR_MESSAGE =
    "Password must include at least 8 characters, uppercase, lowercase, and a special character.";
