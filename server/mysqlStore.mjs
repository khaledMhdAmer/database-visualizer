import mysql from "mysql2/promise";

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "database_visualizer";

const DEFAULT_SCHEMA = {
  version: 1,
  databases: [],
};

let pool;

export const initStore = async () => {
  if (pool) {
    return pool;
  }

  const bootstrap = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
  });

  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await bootstrap.end();

  pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_store (
      id TINYINT UNSIGNED PRIMARY KEY,
      payload LONGTEXT NOT NULL,
      updated_at DATETIME(3) NOT NULL
    )
  `);

  const [rows] = await pool.query("SELECT id FROM schema_store WHERE id = 1 LIMIT 1");
  if (!Array.isArray(rows) || rows.length === 0) {
    await pool.query(
      "INSERT INTO schema_store (id, payload, updated_at) VALUES (1, ?, NOW(3))",
      [JSON.stringify(DEFAULT_SCHEMA)],
    );
  }

  return pool;
};

export const getSchema = async () => {
  const db = await initStore();
  const [rows] = await db.query("SELECT payload FROM schema_store WHERE id = 1 LIMIT 1");

  if (!Array.isArray(rows) || rows.length === 0 || !rows[0].payload) {
    return DEFAULT_SCHEMA;
  }

  try {
    return JSON.parse(rows[0].payload);
  } catch {
    return DEFAULT_SCHEMA;
  }
};

export const saveSchema = async (schema) => {
  if (!schema || typeof schema !== "object") {
    throw new Error("Invalid schema payload");
  }

  const db = await initStore();
  await db.query(
    "UPDATE schema_store SET payload = ?, updated_at = NOW(3) WHERE id = 1",
    [JSON.stringify(schema)],
  );
};

export const getConnectionInfo = () => ({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  database: DB_NAME,
});
