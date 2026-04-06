import express from "express";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const PORT = Number(process.env.PORT || 8787);
const dbDir = path.join(process.cwd(), "db");
const dbPath = path.join(dbDir, "schema.db");

const DEFAULT_SCHEMA = {
  version: 1,
  databases: [],
};

fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_store (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

const seed = db.prepare("SELECT 1 FROM schema_store WHERE id = 1").get();
if (!seed) {
  db.prepare("INSERT INTO schema_store (id, payload, updated_at) VALUES (1, ?, ?)").run(
    JSON.stringify(DEFAULT_SCHEMA),
    new Date().toISOString(),
  );
}

const app = express();
app.use(express.json({ limit: "5mb" }));

app.get("/api/schema", (_req, res) => {
  const row = db.prepare("SELECT payload FROM schema_store WHERE id = 1").get();

  if (!row?.payload) {
    res.json(DEFAULT_SCHEMA);
    return;
  }

  try {
    res.json(JSON.parse(row.payload));
  } catch {
    res.json(DEFAULT_SCHEMA);
  }
});

app.put("/api/schema", (req, res) => {
  const schema = req.body;

  if (!schema || typeof schema !== "object") {
    res.status(400).json({ error: "Invalid schema payload" });
    return;
  }

  db.prepare("UPDATE schema_store SET payload = ?, updated_at = ? WHERE id = 1").run(
    JSON.stringify(schema),
    new Date().toISOString(),
  );

  res.status(204).send();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`[schema-server] listening on http://localhost:${PORT}`);
  console.log(`[schema-server] db file: ${dbPath}`);
});
