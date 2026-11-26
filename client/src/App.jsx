import { useCallback, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api.js";

function getError(error) {
  return error?.response?.data?.message || error?.message || "Request failed.";
}

const DEFAULT_PAGINATION = {
  page: 1,
  limit: 5,
  total: 0,
  totalPages: 1,
  hasPrev: false,
  hasNext: false,
};

export default function App() {
  const [me, setMe] = useState(null);
  const [notes, setNotes] = useState([]);
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  const [tags, setTags] = useState([]);

  const [scope, setScope] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [page, setPage] = useState(1);

  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const loadNotes = useCallback(async () => {
    const endpoint = scope === "mine" ? "/notes/mine" : "/notes";
    try {
      const response = await api.get(endpoint, {
        params: {
          search: search || undefined,
          tag: activeTag || undefined,
          page,
          limit: 5,
        },
      });
      setNotes(response.data.notes ?? []);
      setPagination(response.data.pagination ?? DEFAULT_PAGINATION);
    } catch (err) {
      setError(getError(err));
      setNotes([]);
    }
  }, [activeTag, page, scope, search]);

  async function loadTags() {
    try {
      const response = await api.get("/tags");
      setTags(Array.isArray(response.data) ? response.data : []);
    } catch {
      setTags([]);
    }
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
    loadTags();
    loadMe();
  }, []);

  useEffect(() => {
    if (scope === "mine" && !me) return;
    loadNotes();
  }, [loadNotes, me, scope]);

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
    setScope("all");
    setPage(1);
    setStatus("Logged out.");
    setError("");
  }

  function toggleFormTag(tagId) {
    setSelectedTags((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  }

  async function handleCreateNote(event) {
    event.preventDefault();
    setError("");
    setStatus("");
    try {
      await api.post("/notes", {
        title,
        body,
        pinned: false,
        tags: selectedTags,
      });
      setTitle("");
      setBody("");
      setSelectedTags([]);
      setPage(1);
      await loadNotes();
      setStatus("Note created and saved in MongoDB.");
    } catch (err) {
      setError(getError(err));
    }
  }

  async function handleTogglePin(note) {
    setError("");
    try {
      await api.patch(`/notes/${encodeURIComponent(note._id)}/pin`);
      await loadNotes();
    } catch (err) {
      setError(getError(err));
    }
  }

  async function handleDelete(noteId) {
    setError("");
    try {
      await api.delete(`/notes/${encodeURIComponent(noteId)}`);
      await loadNotes();
    } catch (err) {
      setError(getError(err));
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setError("");
    setSearch(searchInput.trim());
    setPage(1);
  }

  function handleScopeChange(nextScope) {
    setError("");
    setScope(nextScope);
    setPage(1);
  }

  const pages = Array.from(
    { length: pagination.totalPages },
    (_, index) => index + 1,
  );

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
            {tags.length > 0 && (
              <div>
                <span className="field-label">Tags</span>
                <div className="tag-row">
                  {tags.map((tag) => {
                    const active = selectedTags.includes(tag._id);
                    return (
                      <button
                        key={tag._id}
                        type="button"
                        className={active ? "tag-button active" : "tag-button secondary"}
                        onClick={() => toggleFormTag(tag._id)}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <button type="submit">Create note</button>
          </form>
        </section>
      )}

      <section className="card">
        <div className="list-header">
          <h2>
            {scope === "mine" ? "My Notes" : "All Notes"} ({pagination.total})
          </h2>
          <div className="tabs">
            <button
              type="button"
              className={scope === "all" ? "active" : "secondary"}
              onClick={() => handleScopeChange("all")}
            >
              All Notes
            </button>
            <button
              type="button"
              className={scope === "mine" ? "active" : "secondary"}
              disabled={!me}
              onClick={() => handleScopeChange("mine")}
            >
              My Notes
            </button>
          </div>
        </div>

        <form className="search-row" onSubmit={handleSearchSubmit}>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search notes by title..."
          />
          <button type="submit">Search</button>
          {search && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setPage(1);
              }}
            >
              Clear
            </button>
          )}
        </form>

        {tags.length > 0 && (
          <div className="tag-row filter-tags">
            <button
              type="button"
              className={activeTag === "" ? "tag-button active" : "tag-button secondary"}
              onClick={() => {
                setActiveTag("");
                setPage(1);
              }}
            >
              All tags
            </button>
            {tags.map((tag) => (
              <button
                key={tag._id}
                type="button"
                className={
                  activeTag === tag._id
                    ? "tag-button active"
                    : "tag-button secondary"
                }
                onClick={() => {
                  setActiveTag(tag._id);
                  setPage(1);
                }}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}

        {notes.length === 0 ? (
          <p className="muted">No notes match this view yet.</p>
        ) : (
          <ul className="note-list">
            {notes.map((note) => (
              <li key={note._id} className="note-item">
                <div>
                  <div className="note-title-row">
                    <strong>{note.title}</strong>
                    {note.pinned && <span className="pill">Pinned</span>}
                    {Array.isArray(note.tags) &&
                      note.tags.map((tag) => (
                        <span key={tag._id} className="pill tag-pill">
                          {tag.name}
                        </span>
                      ))}
                  </div>
                  <p>{note.body}</p>
                  <p className="owner-line">
                    Owner: {note.owner?.email || "Unknown"}
                  </p>
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
                    onClick={() => handleDelete(note._id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <nav className="pagination-bar" aria-label="Notes pages">
          <span className="muted">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="actions">
            <button
              type="button"
              className="secondary"
              disabled={!pagination.hasPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            {pages.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                className={pageNumber === pagination.page ? "active" : "secondary"}
                aria-current={pageNumber === pagination.page ? "page" : undefined}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              className="secondary"
              disabled={!pagination.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </nav>
      </section>
    </div>
  );
}
