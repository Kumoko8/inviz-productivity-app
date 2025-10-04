// services/api.ts
export const loginUser = async (email: string, password: string) => {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
};

export const registerUser = async (data: any) => {
  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
};

export const fetchUserCharacters = async () => {
  const res = await fetch("/api/characters"); // this should be protected by your auth middleware
  return res.json();
};

export const fetchCharacterSkills = async (characterId: string) => {
  const res = await fetch(`/api/characters/${characterId}/skills`);
  return res.json();
};
