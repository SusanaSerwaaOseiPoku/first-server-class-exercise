import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, beforeEach, mock, test } from "node:test";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Note from "../models/Note.js";
import Tag, { DEFAULT_TAGS, seedDefaultTags } from "../models/Tag.js";
import User from "../models/User.js";
import { createApp, getCorsOptions } from "../server.js";

process.env.JWT_SECRET ||= "test-only-notes-api-jwt-secret";

let server;
let baseUrl;
let collections;

function matchesFilter(doc, filter = {}) {
  return Object.entries(filter).every(([field, expected]) => {
    const actual = doc[field];
    if (expected && typeof expected === "object" && expected.$regex !== undefined) {
      const regex = new RegExp(expected.$regex, expected.$options || "");
      return regex.test(String(actual ?? ""));
    }
    if (Array.isArray(actual)) {
      return actual.some((item) => String(item) === String(expected));
    }
    if (typeof expected === "boolean") {
      return actual === expected;
    }
    return String(actual) === String(expected);
  });
}

function compareValues(a, b, direction) {
  const left = typeof a === "boolean" ? Number(a) : a instanceof Date ? a.getTime() : typeof a === "string" ? a.toLowerCase() : a ?? 0;
  const right = typeof b === "boolean" ? Number(b) : b instanceof Date ? b.getTime() : typeof b === "string" ? b.toLowerCase() : b ?? 0;
  if (left === right) return 0;
  return left < right ? -1 * direction : 1 * direction;
}

function projectDoc(doc, select) {
  if (!doc) return null;
  const plain = typeof doc.toJSON === "function" ? doc.toJSON() : { ...doc };
  if (!select) return plain;
  const fields = select.split(/\s+/).filter(Boolean);
  const picked = { _id: plain._id };
  for (const field of fields) {
    if (field in plain) {
      picked[field] = plain[field];
    }
  }
  return picked;
}

function applyPopulate(doc, populateSteps) {
  if (!doc) return null;
  const result = typeof doc.toJSON === "function" ? doc.toJSON() : { ...doc };

  for (const { path, select } of populateSteps) {
    if (path === "owner") {
      const user = collections.users.find(
        (entry) => String(entry._id) === String(doc.ownerId),
      );
      result.owner = projectDoc(user, select);
    } else if (path === "tags") {
      const tagIds = Array.isArray(doc.tags) ? doc.tags : [];
      result.tags = tagIds
        .map((id) =>
          collections.tags.find((tag) => String(tag._id) === String(id)),
        )
        .filter(Boolean)
        .map((tag) => projectDoc(tag, select));
    }
  }

  return result;
}

function makeListQuery(items) {
  let sortSpec = null;
  let skipCount = 0;
  let limitCount = null;
  const populateSteps = [];

  const query = {
    sort(spec) {
      sortSpec = spec;
      return query;
    },
    skip(count) {
      skipCount = count;
      return query;
    },
    limit(count) {
      limitCount = count;
      return query;
    },
    populate(path, select) {
      populateSteps.push({ path, select });
      return query;
    },
    exec() {
      let list = [...items];
      if (sortSpec) {
        list.sort((left, right) => {
          for (const [field, direction] of Object.entries(sortSpec)) {
            const cmp = compareValues(left[field], right[field], direction);
            if (cmp !== 0) return cmp;
          }
          return 0;
        });
      }
      if (skipCount > 0) {
        list = list.slice(skipCount);
      }
      if (limitCount !== null) {
        list = list.slice(0, limitCount);
      }
      return Promise.resolve(
        populateSteps.length > 0
          ? list.map((doc) => applyPopulate(doc, populateSteps))
          : list,
      );
    },
    then(resolve, reject) {
      return query.exec().then(resolve, reject);
    },
  };

  return query;
}

function makeSingleQuery(doc) {
  const populateSteps = [];
  const query = {
    populate(path, select) {
      populateSteps.push({ path, select });
      return query;
    },
    exec() {
      if (!doc) return Promise.resolve(null);
      if (populateSteps.length === 0) return Promise.resolve(doc);
      const populated = applyPopulate(doc, populateSteps);
      populated.save = async function savePopulated() {
        for (const key of ["title", "body", "pinned", "tags"]) {
          if (key in populated) {
            doc[key] = populated[key];
          }
        }
        await doc.validate();
        return doc;
      };
      return Promise.resolve(populated);
    },
    then(resolve, reject) {
      return query.exec().then(resolve, reject);
    },
  };
  return query;
}

function wireModel(Model, key) {
  let clock = 1;

  mock.method(Model, "find", (filter = {}) => {
    const matches = collections[key].filter((doc) => matchesFilter(doc, filter));
    return makeListQuery(matches);
  });

  mock.method(Model, "countDocuments", async (filter = {}) => {
    return collections[key].filter((doc) => matchesFilter(doc, filter)).length;
  });

  mock.method(Model, "findOne", async (filter = {}) => {
    return collections[key].find((doc) => matchesFilter(doc, filter)) || null;
  });

  mock.method(Model, "findById", (id) => {
    const doc =
      collections[key].find((entry) => String(entry._id) === String(id)) ||
      null;
    return makeSingleQuery(doc);
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
  collections = { users: [], notes: [], tags: [] };
  wireModel(User, "users");
  wireModel(Note, "notes");
  wireModel(Tag, "tags");

  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  collections.users = [];
  collections.notes = [];
  collections.tags = [];
  await seedDefaultTags();
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

async function createUserAndLogin(email) {
  await request("/auth/register", {
    method: "POST",
    body: { email, password: "password123" },
  });
  const login = await request("/auth/login", {
    method: "POST",
    body: { email, password: "password123" },
  });
  return login.payload;
}

test("models link Note.ownerId to User and Note.tags to Tag, seedDefaultTags creates three tags, and /health reports readyState", async () => {
  await assert.rejects(() => connectDB(""), /MONGO_URI/);

  const pkgPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../package.json",
  );
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  assert.equal(pkg.scripts.start, "node server.js");
  assert.ok(pkg.engines?.node);

  const corsOptions = getCorsOptions("https://notes.example.com");
  await new Promise((resolve, reject) => {
    corsOptions.origin("https://notes.example.com", (err, allowed) =>
      err || !allowed ? reject(err || new Error("Expected allowed")) : resolve(),
    );
  });
  await new Promise((resolve, reject) => {
    corsOptions.origin("https://blocked.example.com", (err) =>
      err ? resolve() : reject(new Error("Expected blocked")),
    );
  });

  const degraded = await request("/health");
  assert.equal(degraded.response.status, 503);
  assert.equal(degraded.payload.status, "degraded");
  assert.equal(degraded.payload.database.status, "disconnected");
  assert.equal(degraded.payload.database.readyState, 0);

  const originalReadyState = Object.getOwnPropertyDescriptor(
    mongoose.connection,
    "readyState",
  );
  Object.defineProperty(mongoose.connection, "readyState", {
    configurable: true,
    value: 1,
  });
  try {
    const healthy = await request("/health");
    assert.equal(healthy.response.status, 200);
    assert.equal(healthy.payload.status, "ok");
    assert.equal(healthy.payload.database.status, "connected");
    assert.equal(healthy.payload.database.readyState, 1);
  } finally {
    if (originalReadyState) {
      Object.defineProperty(
        mongoose.connection,
        "readyState",
        originalReadyState,
      );
    } else {
      delete mongoose.connection.readyState;
    }
  }

  assert.equal(Note.schema.path("ownerId").options.ref, "User");
  assert.ok(Note.schema.virtuals.owner);
  assert.equal(Note.schema.path("tags").options.type[0].ref, "Tag");

  const tagsResponse = await request("/tags");
  assert.equal(tagsResponse.response.status, 200);
  assert.equal(tagsResponse.payload.length, DEFAULT_TAGS.length);
  assert.deepEqual(
    tagsResponse.payload.map((tag) => tag.name).sort(),
    [...DEFAULT_TAGS].sort(),
  );
});

test("GET /notes populates owner email (no secrets) and tags, GET /notes/mine stays above /:id, and checkOwner enforces 403 with two users", async () => {
  const userA = await createUserAndLogin("ama@notes.test");
  const userB = await createUserAndLogin("kojo@notes.test");

  const tags = (await request("/tags")).payload;
  const workTag = tags.find((t) => t.name === "Work");
  const urgentTag = tags.find((t) => t.name === "Urgent");

  assert.equal((await request("/notes/mine")).response.status, 401);

  const noteA = await request("/notes", {
    method: "POST",
    token: userA.token,
    body: {
      title: "Ama project plan",
      body: "Prepare sprint review",
      tags: [workTag._id, urgentTag._id],
    },
  });
  assert.equal(noteA.response.status, 201);
  assert.equal(noteA.payload.owner.email, "ama@notes.test");
  assert.equal(noteA.payload.owner.passwordHash, undefined);
  assert.deepEqual(
    noteA.payload.tags.map((tag) => tag.name).sort(),
    ["Urgent", "Work"],
  );

  await request("/notes", {
    method: "POST",
    token: userB.token,
    body: { title: "Kojo shopping list", body: "Milk and bread" },
  });

  const allNotes = await request("/notes");
  assert.equal(allNotes.response.status, 200);
  assert.equal(allNotes.payload.notes.length, 2);
  assert.ok(allNotes.payload.notes.every((n) => n.owner?.email && !n.owner.passwordHash));

  const amaMine = await request("/notes/mine", { token: userA.token });
  assert.equal(amaMine.response.status, 200);
  assert.equal(amaMine.payload.notes.length, 1);
  assert.equal(amaMine.payload.notes[0].title, "Ama project plan");

  assert.equal(
    (
      await request(`/notes/${noteA.payload._id}`, {
        method: "PATCH",
        token: userB.token,
        body: { title: "Hijacked" },
      })
    ).response.status,
    403,
  );
  assert.equal(
    (
      await request(`/notes/${noteA.payload._id}/pin`, {
        method: "PATCH",
        token: userB.token,
      })
    ).response.status,
    403,
  );
  assert.equal(
    (
      await request(`/notes/${noteA.payload._id}`, {
        method: "DELETE",
        token: userB.token,
      })
    ).response.status,
    403,
  );

  const ownerUpdate = await request(`/notes/${noteA.payload._id}`, {
    method: "PATCH",
    token: userA.token,
    body: { title: "Ama updated plan" },
  });
  assert.equal(ownerUpdate.response.status, 200);
  assert.equal(ownerUpdate.payload.title, "Ama updated plan");
});

test("supports ?search= (title contains), ?page= with limit 5, and challenge ?tag=<tagId>", async () => {
  const userA = await createUserAndLogin("ama@notes.test");
  const tags = (await request("/tags")).payload;
  const workTag = tags.find((t) => t.name === "Work");
  const personalTag = tags.find((t) => t.name === "Personal");

  for (let i = 1; i <= 6; i++) {
    await request("/notes", {
      method: "POST",
      token: userA.token,
      body: {
        title: i <= 2 ? `Work report ${i}` : `Personal note ${i}`,
        body: `Body ${i}`,
        tags: i <= 2 ? [workTag._id] : [personalTag._id],
      },
    });
  }

  const page1 = await request("/notes?page=1");
  assert.equal(page1.response.status, 200);
  assert.equal(page1.payload.notes.length, 5);
  assert.deepEqual(page1.payload.pagination, {
    page: 1,
    limit: 5,
    total: 6,
    totalPages: 2,
    hasPrev: false,
    hasNext: true,
  });

  const page2 = await request("/notes?page=2");
  assert.equal(page2.response.status, 200);
  assert.equal(page2.payload.notes.length, 1);
  assert.equal(page2.payload.pagination.hasPrev, true);
  assert.equal(page2.payload.pagination.hasNext, false);

  const searched = await request("/notes?search=report");
  assert.equal(searched.response.status, 200);
  assert.equal(searched.payload.notes.length, 2);
  assert.ok(searched.payload.notes.every((n) => /report/i.test(n.title)));

  const byTag = await request(`/notes?tag=${workTag._id}`);
  assert.equal(byTag.response.status, 200);
  assert.equal(byTag.payload.notes.length, 2);
  assert.ok(
    byTag.payload.notes.every((n) =>
      n.tags.some((t) => String(t._id) === String(workTag._id)),
    ),
  );

  const badTag = await request("/notes?tag=not-an-id");
  assert.equal(badTag.response.status, 400);
});
