import { apiClient } from "@/lib/api/client";
import { getAuthCookies, setAuthCookies } from "@/lib/auth/cookies";

export async function getValidAccessToken() {
  const { accessToken, refreshToken } = await getAuthCookies();

  if (accessToken) {
    return accessToken;
  }

  if (!refreshToken) {
    return null;
  }

  try {
    const response = await apiClient.post("/token/refresh/", {
      refresh: refreshToken,
    });

    const newAccessToken = response.data?.access;
    if (newAccessToken) {
      await setAuthCookies(newAccessToken, refreshToken);
      return newAccessToken;
    }
  } catch (error) {
    console.error("Failed to refresh access token", error);
  }

  return null;
}




