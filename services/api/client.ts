import { getToken, clearToken } from './auth';

const BASE_URL = 'https://api.montevideo.gub.uy/api/transportepublico';

export async function fetchWithAuth(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getToken();

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    // Token may have been invalidated server-side; clear cache and retry once
    clearToken();
    const freshToken = await getToken();

    return fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${freshToken}`,
      },
    });
  }

  return response;
}
