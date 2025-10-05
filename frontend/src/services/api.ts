// frontend/services/api.ts
import axios from "axios";

// Create an axios instance with baseURL
const api = axios.create({
  baseURL: "http://localhost:5000/api", // adjust to your backend URL
});

// Add a request interceptor to include the auth token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token"); // assume you store JWT in localStorage
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Example API calls:

// --- User Auth ---
export const loginUser = (email: string, password: string) =>
  api.post("/auth/login", { email, password });

export const registerUser = (name: string, email: string, password: string) =>
  api.post("/auth/register", { name, email, password });

// --- Characters ---
export const getCharacters = () => api.get("/characters");
export const createCharacter = (name: string, baseImage: string) =>
  api.post("/characters", { name, baseImage });
export const deleteCharacter = (charId: string) =>
  api.delete(`/characters/${charId}`);
export const chooseCharacter = (charId: string) =>
  api.put(`/characters/${charId}/choose`); // example route for choosing

// --- Skills ---
export const addSkill = (charId: string, name: string) =>
  api.post(`/characters/${charId}/skills`, { name });

export const deleteSkill = (charId: string, skillId: string) =>
  api.delete(`/characters/${charId}/skills/${skillId}`);

export const updateSkill = (
  charId: string,
  skillId: string,
  progress: number,
  mastered: boolean
) => api.put(`/characters/${charId}/skills/${skillId}`, { progress, mastered });

export default api;
