import request from "supertest";
import app from "../app.js";

let userCounter = 0;

export async function getToken(overrides = {}) {
  userCounter += 1;
  const email = overrides.email ?? `tester${userCounter}@notes.test`;
  const password = overrides.password ?? "password123";

  const registerRes = await request(app)
    .post("/auth/register")
    .send({ email, password });

  if (registerRes.status !== 201) {
    throw new Error(
      `getToken register failed (${registerRes.status}): ${JSON.stringify(registerRes.body)}`,
    );
  }

  const loginRes = await request(app)
    .post("/auth/login")
    .send({ email, password });

  if (loginRes.status !== 200 || !loginRes.body?.token) {
    throw new Error(
      `getToken login failed (${loginRes.status}): ${JSON.stringify(loginRes.body)}`,
    );
  }

  return {
    token: loginRes.body.token,
    user: loginRes.body.user,
    email,
    password,
  };
}
