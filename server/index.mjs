import express from "express";
import { getConnectionInfo, getSchema, initStore, saveSchema } from "./mysqlStore.mjs";

const PORT = Number(process.env.PORT || 8787);

const app = express();
app.use(express.json({ limit: "5mb" }));

app.get("/api/schema", async (_req, res) => {
  try {
    const schema = await getSchema();
    res.json(schema);
  } catch {
    res.status(500).json({ error: "Failed to load schema" });
  }
});

app.put("/api/schema", async (req, res) => {
  const schema = req.body;

  try {
    await saveSchema(schema);
    res.status(204).send();
  } catch {
    res.status(400).json({ error: "Invalid schema payload" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const bootstrap = async () => {
  await initStore();
  const conn = getConnectionInfo();

  app.listen(PORT, () => {
    console.log(`[schema-server] listening on http://localhost:${PORT}`);
    console.log(
      `[schema-server] mysql: ${conn.user}@${conn.host}:${conn.port}/${conn.database}`,
    );
  });
};

bootstrap().catch((error) => {
  console.error("[schema-server] failed to start", error);
  process.exit(1);
});
