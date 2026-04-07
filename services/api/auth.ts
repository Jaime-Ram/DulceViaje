const TOKEN_URL = 'https://mvdapi-auth.montevideo.gub.uy/token';

interface TokenCache {
  accessToken: string;
  expiresAt: number; // unix ms
}

let tokenCache: TokenCache | null = null;

export async function getToken(): Promise<string> {
  const now = Date.now();

  if (tokenCache && now < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const clientId = process.env.EXPO_PUBLIC_API_CLIENT_ID;
  const clientSecret = process.env.EXPO_PUBLIC_API_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing API credentials. Set EXPO_PUBLIC_API_CLIENT_ID and EXPO_PUBLIC_API_CLIENT_SECRET in your .env file.'
    );
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to obtain access token: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('Token response did not include access_token');
  }

  // expires_in is in seconds; subtract 30s buffer
  const expiresIn: number = typeof data.expires_in === 'number' ? data.expires_in : 3600;
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + (expiresIn - 30) * 1000,
  };

  return tokenCache.accessToken;
}

export function clearToken(): void {
  tokenCache = null;
}
