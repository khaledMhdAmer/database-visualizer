import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SCHEMA_FILE,
  type SchemaFile,
} from "../types/schema";

const STORAGE_KEY = "blueprint-schema-designer";
const TEMP_STORAGE_KEY = `${STORAGE_KEY}:tmp`;

let saveTimer: number | undefined;

const sanitizeSchema = (raw: unknown): SchemaFile => {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_SCHEMA_FILE;
  }

  const parsed = raw as Partial<SchemaFile>;
  const version = typeof parsed.version === "number" ? parsed.version : CURRENT_SCHEMA_VERSION;
  const databases = Array.isArray(parsed.databases) ? parsed.databases : [];

  return {
    version,
    databases,
  };
};

export const loadSchema = (): SchemaFile => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SCHEMA_FILE;
    }

    const parsed = JSON.parse(raw);
    const schema = sanitizeSchema(parsed);

    if (!schema.version) {
      return {
        ...schema,
        version: CURRENT_SCHEMA_VERSION,
      };
    }

    return schema;
  } catch {
    return DEFAULT_SCHEMA_FILE;
  }
};

export const atomicSave = (data: SchemaFile): void => {
  const payload = JSON.stringify(data);
  localStorage.setItem(TEMP_STORAGE_KEY, payload);
  localStorage.setItem(STORAGE_KEY, payload);
  localStorage.removeItem(TEMP_STORAGE_KEY);
};

export const saveSchema = (data: SchemaFile): void => {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
  }

  saveTimer = window.setTimeout(() => {
    atomicSave(data);
  }, 300);
};
