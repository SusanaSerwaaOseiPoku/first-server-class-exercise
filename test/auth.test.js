import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app.js";
import User from "../models/User.js";
import { getToken } from "./helpers.js";

describe("Auth endpoints (/auth)", () => {
  it("POST /auth/register creates a user, hashes the password, and never returns passwordHash", async () => {
    // Arrange
    const credentials = {
      email: "Ama@Notes.Test",
      password: "secretpassword",
    };

    // Act
    const response = await request(app)
      .post("/auth/register")
      .send(credentials);

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.email).toBe("ama@notes.test");
    expect(response.body.id).toBeTruthy();
    expect(response.body.password).toBeUndefined();
    expect(response.body.passwordHash).toBeUndefined();

    const storedUser = await User.findOne({ email: "ama@notes.test" });
    expect(storedUser).toBeTruthy();
    expect(storedUser.passwordHash).not.toBe(credentials.password);
  });

  it("POST /auth/register rejects a repeated email with 409", async () => {
    // Arrange
    await request(app)
      .post("/auth/register")
      .send({ email: "duplicate@notes.test", password: "password123" });

    // Act
    const response = await request(app)
      .post("/auth/register")
      .send({ email: "duplicate@notes.test", password: "anotherpassword" });

    // Assert
    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already exists/i);
  });

  it("POST /auth/login rejects a wrong password with 401", async () => {
    // Arrange
    await request(app)
      .post("/auth/register")
      .send({ email: "kojo@notes.test", password: "correctpassword" });

    // Act
    const response = await request(app)
      .post("/auth/login")
      .send({ email: "kojo@notes.test", password: "wrongpassword" });

    // Assert
    expect(response.status).toBe(401);
    expect(response.body.token).toBeUndefined();
    expect(response.body.message).toMatch(/invalid email or password/i);
  });

  it("rejects protected routes when no token is provided with 401", async () => {
    // Act
    const meResponse = await request(app).get("/auth/me");
    const createNoteResponse = await request(app)
      .post("/notes")
      .send({ title: "Unauthenticated note", body: "Should fail" });

    // Assert
    expect(meResponse.status).toBe(401);
    expect(meResponse.body.message).toMatch(/authentication required/i);
    expect(createNoteResponse.status).toBe(401);
    expect(createNoteResponse.body.message).toMatch(/authentication required/i);
  });

  it("GET /auth/me returns the logged-in user when given a valid token", async () => {
    // Arrange
    const { token, email } = await getToken({ email: "me@notes.test" });

    // Act
    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.email).toBe(email);
    expect(response.body.passwordHash).toBeUndefined();
  });
});
