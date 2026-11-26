import assert from "node:assert/strict";
import { after, before, beforeEach, mock, test } from "node:test";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Note from "../models/Note.js";
import User from "../models/User.js";
import { createApp } from "../server.js";

process.env.JWT_SECRET ||= "test-only-notes-api-jwt-secret";

let server;
let baseUrl;
let collections;

function compareValues(a, b, direction) {
  const left = typeof a === "boolean" ? Number(a) : a instanceof Date ? a.getTime() : a ?? 0;
  const right = typeof b === "boolean" ? Number(b) : b instanceof Date ? b.getTime() : b ?? 0;
  if (left === right) return 0;
  return left < right ? -1 * direction : 1 * direction;
}

function makeQuery(items) {
  return {
    sort(spec = {}) {
      const sorted = [...items].sort((left, right) => {
        for (const [field, direction] of Object.entries(spec)) {
          const cmp = compareValues(left[field], right[field], direction);
          if (cmp !== 0) return cmp;
        }
        return 0;
      });
      return Promise.resolve(sorted);
    },
    then(resolve, reject) {
      return Promise.resolve([...items]).then(resolve, reject);
    },
  };
}

function wireModel(Model, key) {
  let clock = 1;

  mock.method(Model, "find", (filter = {}) => {
    const matches = collections[key].filter((doc) =>
      Object.entries(filter).every(([field, value]) =>
        typeof value === "boolean"
          ? doc[field] === value
          : String(doc[field]) === String(value),
      ),
    );
    return makeQuery(matches);
  });

  mock.method(Model, "findOne", async (filter = {}) => {
    return (
      collections[key].find((doc) =>
        Object.entries(filter).every(
          ([field, value]) => String(doc[field]) === String(value),
        ),
      ) || null
    );
  });

  mock.method(Model, "findById", async (id) => {
    return collections[key].find((doc) => String(doc._id) === String(id)) || null;
  });

  mock.method(Model, "create", async (payload) => {
    const doc = new Model(payload);
    doc.createdAt = new Date(Date.now() + clock++ * 1000);
    doc.updatedAt = doc.createdAt;
    await doc.validate();
    doc.save = async function saveMock() {
      this.updatedAt = new Date(Date.now() + clock++ * 1000);
      await this.validate();
      return this;
    };
    collections[key].push(doc);
    return doc;
  });

  mock.method(Model, "findByIdAndDelete", async (id) => {
    const index = collections[key].findIndex(
      (doc) => String(doc._id) === String(id),
    );
    if (index === -1) return null;
    const [removed] = collections[key].splice(index, 1);
    return removed;
  });
}

before(async () => {
  collections = { users: [], notes: [] };
  wireModel(User, "users");
  wireModel(Note, "notes");

  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  collections.users = [];
  collections.notes = [];
});

after(async () => {
  mock.restoreAll();
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

test("connectDB requires MONGO_URI and Note and User models enforce required fields and defaults", async () => {
  await assert.rejects(() => connectDB(""), /MONGO_URI/);

  const user = new User({
    email: "AMA@NOTES.TEST",
    passwordHash: "$2b$10$examplehash",
  });
  await user.validate();
  assert.equal(user.email, "ama@notes.test");
  assert.equal(user.toJSON().passwordHash, undefined);

  const note = new Note({ title: "Mongo Note", ownerId: user._id });
  await note.validate();
  assert.equal(note.body, "");
  assert.equal(note.pinned, false);

  const badNote = new Note({ title: "hi" });
  await assert.rejects(() => badNote.validate());
});

test("register hashes passwords (409 duplicate), login returns token (401 wrong), and /auth/me returns email", async () => {
  const registered = await request("/auth/register", {
    method: "POST",
    body: { email: "Ama@Notes.Test", password: "password123" },
  });
  assert.equal(registered.response.status, 201);
  assert.equal(registered.payload.email, "ama@notes.test");
  assert.ok(mongoose.isValidObjectId(registered.payload._id));
  assert.equal(registered.payload.passwordHash, undefined);
  assert.match(collections.users[0].passwordHash, /^\$2[aby]\$/);

  const duplicate = await request("/auth/register", {
    method: "POST",
    body: { email: "ama@notes.test", password: "otherpassword" },
  });
  assert.equal(duplicate.response.status, 409);

  const wrongPassword = await request("/auth/login", {
    method: "POST",
    body: { email: "ama@notes.test", password: "wrong" },
  });
  assert.equal(wrongPassword.response.status, 401);

  const loggedIn = await request("/auth/login", {
    method: "POST",
    body: { email: "ama@notes.test", password: "password123" },
  });
  assert.equal(loggedIn.response.status, 200);
  assert.ok(loggedIn.payload.token);

  assert.equal((await request("/auth/me")).response.status, 401);
  const me = await request("/auth/me", { token: loggedIn.payload.token });
  assert.equal(me.response.status, 200);
  assert.equal(me.payload.email, "ama@notes.test");
  assert.equal(me.payload.passwordHash, undefined);
});

test("findNote uses Note.findById (400 bad id, 404 missing); GET stays open and write routes require 401", async () => {
  const emptyList = await request("/notes");
  assert.equal(emptyList.response.status, 200);
  assert.deepEqual(emptyList.payload, []);

  assert.equal((await request("/notes/not-an-id")).response.status, 400);

  const missingId = new mongoose.Types.ObjectId().toString();
  assert.equal((await request(`/notes/${missingId}`)).response.status, 404);
  assert.equal((await request("/nothing")).response.status, 404);

  assert.equal(
    (await request("/notes", { method: "POST", body: { title: "Blocked" } }))
      .response.status,
    401,
  );
  assert.equal(
    (
      await request(`/notes/${missingId}`, {
        method: "PATCH",
        body: { title: "Blocked" },
      })
    ).response.status,
    401,
  );
  assert.equal(
    (await request(`/notes/${missingId}/pin`, { method: "PATCH" })).response
      .status,
    401,
  );
  assert.equal(
    (await request(`/notes/${missingId}`, { method: "DELETE" })).response
      .status,
    401,
  );
});

test("notes save ownerId, enforce 403 for non-owners, toggle pinned via PATCH /notes/:id/pin, and sort pinned first", async () => {
  await request("/auth/register", {
    method: "POST",
    body: { email: "ama@notes.test", password: "password123" },
  });
  const loginA = await request("/auth/login", {
    method: "POST",
    body: { email: "ama@notes.test", password: "password123" },
  });
  const tokenA = loginA.payload.token;
  const userAId = loginA.payload.user._id;

  await request("/auth/register", {
    method: "POST",
    body: { email: "kojo@notes.test", password: "password123" },
  });
  const loginB = await request("/auth/login", {
    method: "POST",
    body: { email: "kojo@notes.test", password: "password123" },
  });
  const tokenB = loginB.payload.token;

  const first = await request("/notes", {
    method: "POST",
    token: tokenA,
    body: { title: "First note", body: "Not pinned yet" },
  });
  assert.equal(first.response.status, 201);
  assert.equal(first.payload.pinned, false);
  assert.equal(first.payload.ownerId, userAId);

  const second = await request("/notes", {
    method: "POST",
    token: tokenA,
    body: { title: "Second note", body: "Newer unpinned note" },
  });
  assert.equal(second.response.status, 201);

  assert.equal(
    (
      await request(`/notes/${first.payload._id}/pin`, {
        method: "PATCH",
        token: tokenB,
      })
    ).response.status,
    403,
  );
  assert.equal(
    (
      await request(`/notes/${first.payload._id}`, {
        method: "PATCH",
        token: tokenB,
        body: { title: "Hijacked" },
      })
    ).response.status,
    403,
  );
  assert.equal(
    (
      await request(`/notes/${first.payload._id}`, {
        method: "DELETE",
        token: tokenB,
      })
    ).response.status,
    403,
  );

  const pinnedFirst = await request(`/notes/${first.payload._id}/pin`, {
    method: "PATCH",
    token: tokenA,
  });
  assert.equal(pinnedFirst.response.status, 200);
  assert.equal(pinnedFirst.payload.pinned, true);

  const sorted = await request("/notes");
  assert.equal(sorted.response.status, 200);
  assert.equal(sorted.payload[0]._id, first.payload._id);
  assert.equal(sorted.payload[0].pinned, true);

  const onlyPinned = await request("/notes?pinned=true");
  assert.equal(onlyPinned.response.status, 200);
  assert.equal(onlyPinned.payload.length, 1);

  const unpinnedFirst = await request(`/notes/${first.payload._id}/pin`, {
    method: "PATCH",
    token: tokenA,
  });
  assert.equal(unpinnedFirst.response.status, 200);
  assert.equal(unpinnedFirst.payload.pinned, false);

  const updated = await request(`/notes/${first.payload._id}`, {
    method: "PATCH",
    token: tokenA,
    body: { title: "Updated first note" },
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.title, "Updated first note");

  const deleted = await request(`/notes/${first.payload._id}`, {
    method: "DELETE",
    token: tokenA,
  });
  assert.equal(deleted.response.status, 204);
  assert.equal(
    (await request(`/notes/${first.payload._id}`)).response.status,
    404,
  );

  const stats = await request("/stats");
  assert.equal(stats.response.status, 200);
  assert.ok(stats.payload.total > 0);
});
