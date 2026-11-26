export function createStarterNotes() {
  return [
    {
      id: "1",
      title: "Welcome",
      body: "This is your first note.",
      pinned: true,
      ownerId: null,
    },
    {
      id: "2",
      title: "Class exercise",
      body: "Build a small Notes API with Express.",
      pinned: false,
      ownerId: null,
    },
    {
      id: "3",
      title: "Remember",
      body: "Check the pinned notes filter.",
      pinned: true,
      ownerId: null,
    },
  ];
}

export function createStarterUsers() {
  return [];
}

export function findUserByEmail(users, email) {
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  return users.find((user) => user.email.toLowerCase() === normalized);
}
