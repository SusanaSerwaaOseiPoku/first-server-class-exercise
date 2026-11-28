import "dotenv/config";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import Note from "../models/Note.js";
import Tag from "../models/Tag.js";
import User from "../models/User.js";

process.env.JWT_SECRET ||= "test-only-notes-api-jwt-secret";
process.env.NODE_ENV = "test";

const TEST_DB_NAME = "notes-test";

export function extractDatabaseName(uri) {
  if (typeof uri !== "string" || !uri.trim()) return "";
  const withoutQuery = uri.trim().split("?")[0];
  const segments = withoutQuery.split("/").filter(Boolean);
  return segments.length >= 3 ? segments[segments.length - 1] : "";
}

export function assertTestDatabaseName(dbName) {
  if (!dbName || !dbName.endsWith("-test")) {
    throw new Error(
      `Refusing to run tests against non-test database "${dbName || "(empty)"}". Test database names MUST end in "-test" (for example "${TEST_DB_NAME}").`,
    );
  }
}

function hasRealTestMongoUri(uri) {
  if (typeof uri !== "string" || !uri.trim()) return false;
  return (
    !uri.includes("<username>") &&
    !uri.includes("<password>") &&
    !uri.includes("<cluster>")
  );
}

let usingRealMongo = false;
let collections = { users: [], notes: [], tags: [] };
let originalReadyStateDescriptor;
let originalNameDescriptor;

export function setDbReadyState(value) {
  Object.defineProperty(mongoose.connection, "readyState", {
    configurable: true,
    value,
  });
}

function setConnectionName(value) {
  Object.defineProperty(mongoose.connection, "name", {
    configurable: true,
    value,
  });
}

function matchesFilter(doc, filter = {}) {
  return Object.entries(filter).every(([field, expected]) => {
    const actual = doc[field];
    if (
      expected &&
      typeof expected === "object" &&
      expected.$regex !== undefined
    ) {
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
  const left =
    typeof a === "boolean"
      ? Number(a)
      : a instanceof Date
        ? a.getTime()
        : typeof a === "string"
          ? a.toLowerCase()
          : (a ?? 0);
  const right =
    typeof b === "boolean"
      ? Number(b)
      : b instanceof Date
        ? b.getTime()
        : typeof b === "string"
          ? b.toLowerCase()
          : (b ?? 0);
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

function wireInMemoryModel(Model, key) {
  let clock = 1;

  vi.spyOn(Model, "find").mockImplementation((filter = {}) => {
    const matches = collections[key].filter((doc) =>
      matchesFilter(doc, filter),
    );
    return makeListQuery(matches);
  });

  vi.spyOn(Model, "countDocuments").mockImplementation(async (filter = {}) => {
    return collections[key].filter((doc) => matchesFilter(doc, filter)).length;
  });

  vi.spyOn(Model, "findOne").mockImplementation(async (filter = {}) => {
    return collections[key].find((doc) => matchesFilter(doc, filter)) || null;
  });

  vi.spyOn(Model, "findById").mockImplementation((id) => {
    const doc =
      collections[key].find((entry) => String(entry._id) === String(id)) ||
      null;
    return makeSingleQuery(doc);
  });

  vi.spyOn(Model, "create").mockImplementation(async (payload) => {
    const doc = new Model(payload);
    doc.createdAt = new Date(Date.now() + clock++ * 1000);
    doc.updatedAt = doc.createdAt;
    await doc.validate();

    if (
      key === "users" &&
      collections.users.some((entry) => entry.email === doc.email)
    ) {
      const duplicateError = new Error("Duplicate email");
      duplicateError.code = 11000;
      throw duplicateError;
    }

    doc.save = async function saveInMemory() {
      this.updatedAt = new Date(Date.now() + clock++ * 1000);
      await this.validate();
      return this;
    };
    collections[key].push(doc);
    return doc;
  });

  vi.spyOn(Model, "findByIdAndDelete").mockImplementation(async (id) => {
    const index = collections[key].findIndex(
      (doc) => String(doc._id) === String(id),
    );
    if (index === -1) return null;
    const [removed] = collections[key].splice(index, 1);
    return removed;
  });

  vi.spyOn(Model, "deleteMany").mockImplementation(async (filter = {}) => {
    const beforeCount = collections[key].length;
    if (!filter || Object.keys(filter).length === 0) {
      collections[key] = [];
      return { deletedCount: beforeCount };
    }
    collections[key] = collections[key].filter(
      (doc) => !matchesFilter(doc, filter),
    );
    return { deletedCount: beforeCount - collections[key].length };
  });
}

async function emptyTestDatabase() {
  if (usingRealMongo) {
    assertTestDatabaseName(mongoose.connection.name);
    const dbCollections = Object.values(mongoose.connection.collections);
    await Promise.all(
      dbCollections.map((collection) => collection.deleteMany({})),
    );
    return;
  }

  collections.users = [];
  collections.notes = [];
  collections.tags = [];
}

beforeAll(async () => {
  const testUri = process.env.MONGO_URI_TEST;
  if (hasRealTestMongoUri(testUri)) {
    const uriDbName = extractDatabaseName(testUri);
    assertTestDatabaseName(uriDbName);
    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 10000 });
    assertTestDatabaseName(mongoose.connection.name);
    usingRealMongo = true;
    await emptyTestDatabase();
    return;
  }

  usingRealMongo = false;
  originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(
    mongoose.connection,
    "readyState",
  );
  originalNameDescriptor = Object.getOwnPropertyDescriptor(
    mongoose.connection,
    "name",
  );

  assertTestDatabaseName(TEST_DB_NAME);
  setConnectionName(TEST_DB_NAME);
  setDbReadyState(1);

  collections = { users: [], notes: [], tags: [] };
  wireInMemoryModel(User, "users");
  wireInMemoryModel(Note, "notes");
  wireInMemoryModel(Tag, "tags");
});

afterEach(async () => {
  if (!usingRealMongo) {
    setDbReadyState(1);
    setConnectionName(TEST_DB_NAME);
  }
  await emptyTestDatabase();
});

afterAll(async () => {
  if (usingRealMongo) {
    await emptyTestDatabase();
    await mongoose.disconnect();
    return;
  }

  vi.restoreAllMocks();

  if (originalReadyStateDescriptor) {
    Object.defineProperty(
      mongoose.connection,
      "readyState",
      originalReadyStateDescriptor,
    );
  } else {
    delete mongoose.connection.readyState;
  }

  if (originalNameDescriptor) {
    Object.defineProperty(mongoose.connection, "name", originalNameDescriptor);
  } else {
    delete mongoose.connection.name;
  }
});
