import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../server.js";

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? undefined : await response.json();
  return { response, payload };
}

test("lists starter notes, looks up IDs, and filters pinned notes", async () => {
  const allNotes = await request("/notes");
  assert.equal(allNotes.response.status, 200);
  assert.equal(allNotes.payload.length, 3);
  assert.deepEqual(Object.keys(allNotes.payload[0]), [
    "id",
    "title",
    "body",
    "pinned",
  ]);

  const note = await request("/notes/1");
  assert.equal(note.response.status, 200);
  assert.equal(note.payload.title, "Welcome");

  const missing = await request("/notes/missing");
  assert.equal(missing.response.status, 404);

  const pinned = await request("/notes?pinned=true");
  assert.equal(pinned.response.status, 200);
  assert.ok(pinned.payload.length > 0);
  assert.ok(pinned.payload.every((entry) => entry.pinned === true));
});

test("returns a JSON 404 for unmatched paths", async () => {
  const missing = await request("/nothing");
  assert.equal(missing.response.status, 404);
  assert.deepEqual(missing.payload, { message: "Endpoint not found." });
});

test("creates notes with a title of at least three characters", async () => {
  const tooShort = await request("/notes", {
    method: "POST",
    body: { title: "ab" },
  });
  assert.equal(tooShort.response.status, 400);

  const whitespace = await request("/notes", {
    method: "POST",
    body: { title: "   " },
  });
  assert.equal(whitespace.response.status, 400);

  const created = await request("/notes", {
    method: "POST",
    body: { title: "  New note  ", body: "Some details", pinned: true },
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.title, "New note");
  assert.equal(created.payload.body, "Some details");
  assert.equal(created.payload.pinned, true);
});

test("updates and deletes notes, returning 404 for unknown IDs", async () => {
  const updated = await request("/notes/2", {
    method: "PATCH",
    body: { title: "Updated note", pinned: true },
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.title, "Updated note");
  assert.equal(updated.payload.pinned, true);

  const invalidUpdate = await request("/notes/2", {
    method: "PATCH",
    body: { title: "no" },
  });
  assert.equal(invalidUpdate.response.status, 400);

  const missingUpdate = await request("/notes/missing", {
    method: "PATCH",
    body: { pinned: true },
  });
  assert.equal(missingUpdate.response.status, 404);

  const deleted = await request("/notes/2", { method: "DELETE" });
  assert.equal(deleted.response.status, 204);
  assert.equal((await request("/notes/2")).response.status, 404);

  const missingDelete = await request("/notes/missing", { method: "DELETE" });
  assert.equal(missingDelete.response.status, 404);
});

test("counts all requests by method, including the stats request", async () => {
  const before = (await request("/stats")).payload;
  const created = await request("/notes", {
    method: "POST",
    body: { title: "Counted request" },
  });
  assert.equal(created.response.status, 201);

  const stats = (await request("/stats")).payload;
  assert.equal(stats.total, before.total + 2);
  assert.equal(stats.byMethod.POST, (before.byMethod.POST ?? 0) + 1);
  assert.equal(stats.byMethod.GET, before.byMethod.GET + 1);
});
