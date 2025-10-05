// frontend/services/api.ts
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Create an axios instance with baseURL
const api = axios.create({
  baseURL: API_URL,
});

// Automatically attach JWT if found
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --------------------
// 🧍 USER AUTH
// --------------------
export const loginUser = async (email: string, password: string) => {
  const res = await api.post("/auth/login", { email, password });
  return res.data;
};

export const registerUser = async (
  name: string,
  email: string,
  password: string
) => {
  const res = await api.post("/auth/register", { name, email, password });
  return res.data;
};

// --------------------
// 🧙 CHARACTERS
// --------------------
export const getCharacters = async () => {
  const res = await api.get("/characters");
  return res.data;
};

export const createCharacter = async (name: string, baseImage: string) => {
  const res = await api.post("/characters", { name, baseImage });
  return res.data;
};

export const deleteCharacter = async (charId: string) => {
  const res = await api.delete(`/characters/${charId}`);
  return res.data;
};

export const chooseCharacter = async (charId: string) => {
  const res = await api.put(`/characters/${charId}/choose`);
  return res.data;
};

// --------------------
// 🧩 SKILLS
// --------------------
export const getSkills = async (characterId: string) => {
  const res = await api.get(`/characters/${characterId}/skills`);
  return res.data;
};

export const addSkill = async (charId: string, name: string) => {
  const res = await api.post(`/characters/${charId}/skills`, { name });
  return res.data;
};

export const deleteSkill = async (charId: string, skillId: string) => {
  const res = await api.delete(`/characters/${charId}/skills/${skillId}`);
  return res.data;
};

export const updateSkill = async (
  charId: string,
  skillId: string,
  progress: number,
  mastered: boolean
) => {
  const res = await api.put(`/characters/${charId}/skills/${skillId}`, {
    progress,
    mastered,
  });
  return res.data;
};

export default api;
