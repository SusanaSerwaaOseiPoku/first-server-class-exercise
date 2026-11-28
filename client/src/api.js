import axios from "axios";

const TOKEN_KEY = "notes_api_token";

export const api = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || "",
  timeout: 15000,
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

export function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (error?.code === "ECONNABORTED" || /timeout/i.test(String(error?.message || ""))) {
    return "The server took too long to respond (15s timeout). It may be waking up—please try again.";
  }

  if (!error?.response) {
    return "Could not reach the server. Check your internet connection and try again.";
  }

  const status = error.response.status;
  const serverMessage = error.response.data?.message;

  if (status === 503) {
    return (
      serverMessage ||
      "The service is temporarily unavailable while connecting to the database. Please try again shortly."
    );
  }
  if (status >= 500) {
    return "Something went wrong on the server. Please try again later.";
  }

  return serverMessage || fallback;
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
