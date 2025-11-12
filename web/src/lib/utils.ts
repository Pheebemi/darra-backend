import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts relative image URLs to absolute URLs pointing to the Django backend
 */
export function getImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  
  // If already absolute URL, return as is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  
  // If relative URL starting with /, prepend Django base URL
  if (url.startsWith("/")) {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api";
    // Remove /api from base URL to get Django root
    const djangoBaseUrl = apiBaseUrl.replace("/api", "");
    return `${djangoBaseUrl}${url}`;
  }
  
  return url;
}




