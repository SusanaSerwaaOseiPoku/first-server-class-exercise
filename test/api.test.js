import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp, createStarterNotes, createStarterUsers } from "../server.js";

process.env.JWT_SECRET ||= "test-only-notes-api-jwt-secret";

let server;
let baseUrl;
let notesStore;
let usersStore;

before(async () => {
  notesStore = createStarterNotes();
  usersStore = createStarterUsers();
  server = createApp(notesStore, usersStore).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function request(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? undefined : await response.json();
  return { response, payload };
}

test("register hashes passwords and returns 409 for repeated emails; login returns a token or 401; /auth/me returns email", async () => {
  const registered = await request("/auth/register", {
    method: "POST",
    body: { email: "Ama@Notes.Test", password: "password123" },
  });
  assert.equal(registered.response.status, 201);
  assert.equal(registered.payload.email, "ama@notes.test");
  assert.equal(registered.payload.password, undefined);
  assert.equal(registered.payload.passwordHash, undefined);

  const savedUser = usersStore.find((user) => user.email === "ama@notes.test");
  assert.ok(savedUser);
  assert.equal(savedUser.password, undefined);
  assert.notEqual(savedUser.passwordHash, "password123");
  assert.match(savedUser.passwordHash, /^\$2[aby]\$/);

  const duplicate = await request("/auth/register", {
    method: "POST",
    body: { email: "ama@notes.test", password: "anotherpassword" },
  });
  assert.equal(duplicate.response.status, 409);

  const wrongPassword = await request("/auth/login", {
    method: "POST",
    body: { email: "ama@notes.test", password: "wrongpassword" },
  });
  assert.equal(wrongPassword.response.status, 401);

  const unknownUser = await request("/auth/login", {
    method: "POST",
    body: { email: "nobody@notes.test", password: "password123" },
  });
  assert.equal(unknownUser.response.status, 401);

  const loggedIn = await request("/auth/login", {
    method: "POST",
    body: { email: "ama@notes.test", password: "password123" },
  });
  assert.equal(loggedIn.response.status, 200);
  assert.ok(loggedIn.payload.token);
  assert.equal(loggedIn.payload.user.email, "ama@notes.test");

  const unauthenticatedMe = await request("/auth/me");
  assert.equal(unauthenticatedMe.response.status, 401);

  const invalidTokenMe = await request("/auth/me", { token: "bad-token" });
  assert.equal(invalidTokenMe.response.status, 401);

  const me = await request("/auth/me", { token: loggedIn.payload.token });
  assert.equal(me.response.status, 200);
  assert.equal(me.payload.email, "ama@notes.test");
  assert.equal(me.payload.password, undefined);
  assert.equal(me.payload.passwordHash, undefined);
});

test("GET /notes stays open while POST, PATCH, and DELETE require authentication (401)", async () => {
  const allNotes = await request("/notes");
  assert.equal(allNotes.response.status, 200);
  assert.equal(allNotes.payload.length, 3);
  assert.deepEqual(Object.keys(allNotes.payload[0]), [
    "id",
    "title",
    "body",
    "pinned",
    "ownerId",
  ]);

  const note = await request("/notes/1");
  assert.equal(note.response.status, 200);
  assert.equal(note.payload.title, "Welcome");

  const pinned = await request("/notes?pinned=true");
  assert.equal(pinned.response.status, 200);
  assert.ok(pinned.payload.every((entry) => entry.pinned === true));

  const missing = await request("/notes/missing");
  assert.equal(missing.response.status, 404);

  const unmatched = await request("/nothing");
  assert.equal(unmatched.response.status, 404);
  assert.deepEqual(unmatched.payload, { message: "Endpoint not found." });

  assert.equal(
    (await request("/notes", { method: "POST", body: { title: "Blocked" } }))
      .response.status,
    401,
  );
  assert.equal(
    (
      await request("/notes/1", {
        method: "PATCH",
        body: { title: "Blocked update" },
      })
    ).response.status,
    401,
  );
  assert.equal(
    (await request("/notes/1", { method: "DELETE" })).response.status,
    401,
  );
});

test("notes save req.user.id as ownerId and enforce ownership on update and delete", async () => {
  const loginA = await request("/auth/login", {
    method: "POST",
    body: { email: "ama@notes.test", password: "password123" },
  });
  const tokenA = loginA.payload.token;
  const userAId = loginA.payload.user.id;

  await request("/auth/register", {
    method: "POST",
    body: { email: "kojo@notes.test", password: "password123" },
  });
  const loginB = await request("/auth/login", {
    method: "POST",
    body: { email: "kojo@notes.test", password: "password123" },
  });
  const tokenB = loginB.payload.token;

  const tooShort = await request("/notes", {
    method: "POST",
    token: tokenA,
    body: { title: "ab" },
  });
  assert.equal(tooShort.response.status, 400);

  const created = await request("/notes", {
    method: "POST",
    token: tokenA,
    body: { title: "  Ama Note  ", body: "Private details", pinned: true },
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.title, "Ama Note");
  assert.equal(created.payload.ownerId, userAId);

  const forbiddenPatch = await request(`/notes/${created.payload.id}`, {
    method: "PATCH",
    token: tokenB,
    body: { title: "Hijacked" },
  });
  assert.equal(forbiddenPatch.response.status, 403);

  const forbiddenDelete = await request(`/notes/${created.payload.id}`, {
    method: "DELETE",
    token: tokenB,
  });
  assert.equal(forbiddenDelete.response.status, 403);

  const ownerPatch = await request(`/notes/${created.payload.id}`, {
    method: "PATCH",
    token: tokenA,
    body: { title: "Updated Ama Note", pinned: false },
  });
  assert.equal(ownerPatch.response.status, 200);
  assert.equal(ownerPatch.payload.title, "Updated Ama Note");
  assert.equal(ownerPatch.payload.pinned, false);
  assert.equal(ownerPatch.payload.ownerId, userAId);

  const ownerDelete = await request(`/notes/${created.payload.id}`, {
    method: "DELETE",
    token: tokenA,
  });
  assert.equal(ownerDelete.response.status, 204);
  assert.equal(
    (await request(`/notes/${created.payload.id}`)).response.status,
    404,
  );
});

test("counts all requests by method, including the stats request", async () => {
  const login = await request("/auth/login", {
    method: "POST",
    body: { email: "ama@notes.test", password: "password123" },
  });
  const token = login.payload.token;

  const before = (await request("/stats")).payload;
  const created = await request("/notes", {
    method: "POST",
    token,
    body: { title: "Counted request" },
  });
  assert.equal(created.response.status, 201);

  const stats = (await request("/stats")).payload;
  assert.equal(stats.total, before.total + 2);
  assert.equal(stats.byMethod.POST, (before.byMethod.POST ?? 0) + 1);
  assert.equal(stats.byMethod.GET, before.byMethod.GET + 1);
});
