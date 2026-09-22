import axios from "axios";
import { auth } from "./firebase";


const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000",
});

// Attach Firebase ID token to every request automatically
API.interceptors.request.use(async (config) => {

  const user = auth.currentUser;

  if (user) {

    const token = await user.getIdToken();

    config.headers.Authorization = `Bearer ${token}`;

  }

  return config;

});
// Global error handler
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired — redirect to home
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

export default API;