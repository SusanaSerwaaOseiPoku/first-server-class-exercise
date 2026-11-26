import axios from "axios";

const TOKEN_KEY = "notes_api_token";

export const api = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || "http://localhost:3002",
});

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
