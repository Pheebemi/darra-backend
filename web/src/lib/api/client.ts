import axios from "axios";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api";

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: false,
});


