export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
