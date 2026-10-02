const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env.local and set the backend URL.');
}

export const env = {
  apiBaseUrl: `${apiUrl.replace(/\/+$/, '')}/api/v1`,
} as const;
