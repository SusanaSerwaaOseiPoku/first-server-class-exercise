import { useEffect, useState } from "react";
import { api, getToken, setToken } from "./api.js";

function getError(error) {
  return error?.response?.data?.message || error?.message || "Request failed.";
}

export default function App() {
  const [me, setMe] = useState(null);
  const [notes, setNotes] = useState([]);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function loadNotes() {
    const response = await api.get("/notes");
    setNotes(response.data);
  }

  async function loadMe() {
    if (!getToken()) {
      setMe(null);
      return;
    }
    try {
      const response = await api.get("/auth/me");
      setMe(response.data);
    } catch {
      setToken("");
      setMe(null);
    }
  }

  useEffect(() => {
    loadNotes().catch((err) => setError(getError(err)));
    loadMe();
  }, []);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setError("");
    setStatus("");
    try {
      if (mode === "register") {
        await api.post("/auth/register", { email, password });
      }
      const loginResponse = await api.post("/auth/login", { email, password });
      setToken(loginResponse.data.token);
      const meResponse = await api.get("/auth/me");
      setMe(meResponse.data);
      setPassword("");
      setStatus(`Signed in via /auth/me as ${meResponse.data.email}`);
    } catch (err) {
      setError(getError(err));
    }
  }

  function handleLogout() {
    setToken("");
    setMe(null);
    setStatus("Logged out.");
    setError("");
  }

  async function handleCreateNote(event) {
    event.preventDefault();
    setError("");
    setStatus("");
    try {
      const response = await api.post("/notes", { title, body, pinned: false });
      setNotes((current) => [...current, response.data]);
      setTitle("");
      setBody("");
      setStatus("Note created.");
    } catch (err) {
      setError(getError(err));
    }
  }

  async function handleTogglePin(note) {
    setError("");
    try {
      const response = await api.patch(`/notes/${note.id}`, {
        pinned: !note.pinned,
      });
      setNotes((current) =>
        current.map((entry) => (entry.id === note.id ? response.data : entry)),
      );
    } catch (err) {
      setError(getError(err));
    }
  }

  async function handleDelete(noteId) {
    setError("");
    try {
      await api.delete(`/notes/${noteId}`);
      setNotes((current) => current.filter((entry) => entry.id !== noteId));
    } catch (err) {
      setError(getError(err));
    }
  }

  return (
    <div className="page">
      <header className="top-bar">
        <h1>Notes App</h1>
        {me ? (
          <div className="greeting-row">
            <strong className="greeting">Hello, {me.email}</strong>
            <button type="button" className="secondary" onClick={handleLogout}>
              Log out
            </button>
          </div>
        ) : (
          <span className="muted">Not signed in (viewing public notes)</span>
        )}
      </header>

      {status && (
        <p className="banner success" role="status">
          {status}
        </p>
      )}
      {error && (
        <p className="banner error" role="alert">
          {error}
        </p>
      )}

      {!me && (
        <section className="card">
          <div className="tabs">
            <button
              type="button"
              className={mode === "login" ? "active" : "secondary"}
              onClick={() => setMode("login")}
            >
              Log in
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : "secondary"}
              onClick={() => setMode("register")}
            >
              Register
            </button>
          </div>
          <form className="stack" onSubmit={handleAuthSubmit}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button type="submit">
              {mode === "login" ? "Log in" : "Register & log in"}
            </button>
          </form>
        </section>
      )}

      {me && (
        <section className="card">
          <h2>New note</h2>
          <form className="stack" onSubmit={handleCreateNote}>
            <label>
              Title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                minLength={3}
                required
              />
            </label>
            <label>
              Body
              <textarea
                rows={3}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>
            <button type="submit">Create note</button>
          </form>
        </section>
      )}

      <section className="card">
        <h2>Notes ({notes.length})</h2>
        <ul className="note-list">
          {notes.map((note) => (
            <li key={note.id} className="note-item">
              <div>
                <strong>{note.title}</strong>
                {note.pinned && <span className="pill">Pinned</span>}
                <p>{note.body}</p>
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleTogglePin(note)}
                >
                  {note.pinned ? "Unpin" : "Pin"}
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => handleDelete(note.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
