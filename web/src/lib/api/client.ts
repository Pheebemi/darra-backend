import axios from "axios";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://darra.vercel.app/api";

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: false,
});


