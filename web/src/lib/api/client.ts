import axios from "axios";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://pheebemi.pythonanywhere.com/api";

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: false,
});


