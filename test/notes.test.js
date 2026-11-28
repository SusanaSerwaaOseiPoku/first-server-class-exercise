import mongoose from "mongoose";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import app, { getCorsOptions } from "../app.js";
import connectDB from "../config/db.js";
import { errorHandler } from "../middleware/errors.js";
import { DEFAULT_TAGS, seedDefaultTags } from "../models/Tag.js";
import { getToken } from "./helpers.js";
import { setDbReadyState } from "./setup.js";

describe("Notes endpoints (/notes) and health/hardening checks", () => {
  it("GET /notes returns an empty list on a clean notes-test database", async () => {
    // Act
    const response = await request(app).get("/notes");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.notes).toEqual([]);
    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 5,
      total: 0,
      totalPages: 1,
    });
  });

  it("POST /notes creates a note (201) linked to the logged-in owner and GET /notes lists it", async () => {
    // Arrange
    const { token, email } = await getToken({ email: "ama@notes.test" });
    const seededTags = await seedDefaultTags();
    const workTag = seededTags.find((tag) => tag.name === "Work");

    // Act
    const created = await request(app)
      .post("/notes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Sprint planning notes",
        body: "Review API test coverage",
        tags: [String(workTag._id)],
      });

    const listResponse = await request(app).get("/notes");

    // Assert
    expect(created.status).toBe(201);
    expect(created.body.title).toBe("Sprint planning notes");
    expect(created.body.owner.email).toBe(email);
    expect(created.body.owner.passwordHash).toBeUndefined();
    expect(created.body.tags.map((tag) => tag.name)).toEqual(["Work"]);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.notes).toHaveLength(1);
    expect(listResponse.body.notes[0].title).toBe("Sprint planning notes");
    expect(listResponse.body.notes[0].owner.email).toBe(email);
  });

  it("GET /notes/mine returns only the logged-in user's notes and supports search, tag, and pagination", async () => {
    // Arrange
    const userA = await getToken({ email: "alice@notes.test" });
    const userB = await getToken({ email: "bob@notes.test" });
    const seededTags = await seedDefaultTags();
    const workTag = seededTags.find((tag) => tag.name === "Work");

    for (let i = 1; i <= 6; i += 1) {
      await request(app)
        .post("/notes")
        .set("Authorization", `Bearer ${userA.token}`)
        .send({
          title: i <= 2 ? `Work report ${i}` : `Personal memo ${i}`,
          body: `Body ${i}`,
          tags: i <= 2 ? [String(workTag._id)] : [],
        });
    }

    await request(app)
      .post("/notes")
      .set("Authorization", `Bearer ${userB.token}`)
      .send({ title: "Bob private draft", body: "Only Bob owns this" });

    // Act
    const mine = await request(app)
      .get("/notes/mine?page=1")
      .set("Authorization", `Bearer ${userA.token}`);
    const page2 = await request(app).get("/notes?page=2");
    const searched = await request(app).get("/notes?search=report");
    const byTag = await request(app).get(`/notes?tag=${workTag._id}`);

    // Assert
    expect(mine.status).toBe(200);
    expect(mine.body.notes).toHaveLength(5);
    expect(mine.body.pagination.total).toBe(6);
    expect(mine.body.notes.every((n) => n.owner.email === userA.email)).toBe(
      true,
    );

    expect(page2.status).toBe(200);
    expect(page2.body.notes).toHaveLength(2);
    expect(page2.body.pagination).toMatchObject({
      page: 2,
      total: 7,
      totalPages: 2,
      hasPrev: true,
      hasNext: false,
    });

    expect(searched.status).toBe(200);
    expect(searched.body.notes).toHaveLength(2);
    expect(byTag.status).toBe(200);
    expect(byTag.body.notes).toHaveLength(2);
  });

  it("POST /notes returns 400 when title is missing or too short", async () => {
    // Arrange
    const { token } = await getToken({ email: "validation@notes.test" });

    // Act
    const missingTitle = await request(app)
      .post("/notes")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "A note without a title" });

    const shortTitle = await request(app)
      .post("/notes")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Hi", body: "Too short" });

    // Assert
    expect(missingTitle.status).toBe(400);
    expect(missingTitle.body.message).toMatch(/title/i);
    expect(shortTitle.status).toBe(400);
    expect(shortTitle.body.message).toMatch(/at least 3 characters/i);
  });

  it("returns 403 when another user tries to update, pin, or delete someone else's note", async () => {
    // Arrange
    const owner = await getToken({ email: "owner@notes.test" });
    const intruder = await getToken({ email: "intruder@notes.test" });

    const created = await request(app)
      .post("/notes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Owner protected note", body: "Do not touch" });

    const noteId = created.body._id;

    // Act
    const patchRes = await request(app)
      .patch(`/notes/${noteId}`)
      .set("Authorization", `Bearer ${intruder.token}`)
      .send({ title: "Hijacked title" });

    const pinRes = await request(app)
      .patch(`/notes/${noteId}/pin`)
      .set("Authorization", `Bearer ${intruder.token}`);

    const deleteRes = await request(app)
      .delete(`/notes/${noteId}`)
      .set("Authorization", `Bearer ${intruder.token}`);

    // Assert
    expect(patchRes.status).toBe(403);
    expect(pinRes.status).toBe(403);
    expect(deleteRes.status).toBe(403);

    // Owner can still delete their own note
    const ownerDelete = await request(app)
      .delete(`/notes/${noteId}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(ownerDelete.status).toBe(204);
  });

  it("returns 400 for a bad note ID and 404 for a valid but missing note ID", async () => {
    // Arrange
    const { token } = await getToken({ email: "ids@notes.test" });
    const missingId = new mongoose.Types.ObjectId().toString();

    // Act
    const badGet = await request(app).get("/notes/not-a-valid-id");
    const badDelete = await request(app)
      .delete("/notes/not-a-valid-id")
      .set("Authorization", `Bearer ${token}`);
    const missingGet = await request(app).get(`/notes/${missingId}`);

    // Assert
    expect(badGet.status).toBe(400);
    expect(badGet.body.message).toMatch(/invalid note id/i);
    expect(badDelete.status).toBe(400);
    expect(missingGet.status).toBe(404);
    expect(missingGet.body.message).toMatch(/not found/i);
  });

  it("reports /health against notes-test, blocks routes with 503 when DB is down, and hides 500 stack details in production", async () => {
    // Arrange & Act: healthy /health and seeded tags
    await seedDefaultTags();
    const healthy = await request(app).get("/health");
    const tags = await request(app).get("/tags");

    // Assert healthy state
    expect(healthy.status).toBe(200);
    expect(healthy.body.status).toBe("ok");
    expect(healthy.body.database.name).toMatch(/-test$/);
    expect(tags.status).toBe(200);
    expect(tags.body.map((t) => t.name).sort()).toEqual(
      [...DEFAULT_TAGS].sort(),
    );

    // Act: simulate disconnected DB
    setDbReadyState(0);
    const degraded = await request(app).get("/health");
    const blocked = await request(app).get("/notes");
    setDbReadyState(1);

    // Assert 503 behavior
    expect(degraded.status).toBe(503);
    expect(degraded.body.status).toBe("degraded");
    expect(blocked.status).toBe(503);

    // Assert connectDB rejects empty URI and preserves root cause when mongoose.connect fails
    await expect(connectDB("")).rejects.toThrow(/MONGO_URI/);

    const rootCause = new Error("ECONNREFUSED atlas");
    const connectSpy = vi
      .spyOn(mongoose, "connect")
      .mockRejectedValueOnce(rootCause);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      let caughtError;
      try {
        await connectDB("mongodb://127.0.0.1:27017/notes-test");
      } catch (error) {
        caughtError = error;
      }
      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError.message).toMatch(/Could not connect to MongoDB/);
      expect(caughtError.cause).toBe(rootCause);
    } finally {
      connectSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }

    const corsOptions = getCorsOptions("https://notes.example.com");
    await expect(
      new Promise((resolve, reject) => {
        corsOptions.origin("https://notes.example.com", (err, allowed) =>
          err || !allowed ? reject(err || new Error("Blocked")) : resolve(true),
        );
      }),
    ).resolves.toBe(true);

    // Assert production errorHandler hides internal details
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      let status = 0;
      let body = null;
      const mockRes = {
        status(code) {
          status = code;
          return this;
        },
        json(payload) {
          body = payload;
          return this;
        },
      };
      errorHandler(
        new Error("internal secret stack detail"),
        { method: "GET", originalUrl: "/boom" },
        mockRes,
        () => {},
      );
      expect(status).toBe(500);
      expect(body.message).toBe(
        "Something went wrong on the server. Please try again later.",
      );
    } finally {
      process.env.NODE_ENV = previousEnv;
    }
  });
});
