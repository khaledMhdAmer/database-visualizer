import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SCHEMA_FILE,
  type SchemaFile,
} from "../types/schema";

const SCHEMA_API = "/api/schema";
const LEGACY_STORAGE_KEY = "blueprint-schema-designer";
const MIGRATION_MARKER_KEY = "blueprint-schema-designer:migrated-to-sqlite";

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

const readLegacySchema = (): SchemaFile | null => {
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) {
      return null;
    }

    const parsed = JSON.parse(legacy);
    const schema = sanitizeSchema(parsed);
    return schema.databases.length > 0 ? schema : null;
  } catch {
    return null;
  }
};

export const migrateLegacyBrowserData = async (): Promise<boolean> => {
  const legacySchema = readLegacySchema();
  if (!legacySchema) {
    return false;
  }

  await atomicSave(legacySchema);
  localStorage.setItem(MIGRATION_MARKER_KEY, "1");
  return true;
};

export const loadSchema = async (): Promise<SchemaFile> => {
  try {
    const response = await fetch(SCHEMA_API);
    if (!response.ok) {
      return DEFAULT_SCHEMA_FILE;
    }

    const parsed = await response.json();
    const schema = sanitizeSchema(parsed);

    if (!schema.version) {
      return {
        ...schema,
        version: CURRENT_SCHEMA_VERSION,
      };
    }

    const alreadyMigrated = localStorage.getItem(MIGRATION_MARKER_KEY) === "1";
    if (!alreadyMigrated && schema.databases.length === 0) {
      const migrated = await migrateLegacyBrowserData();
      if (migrated) {
        return readLegacySchema() ?? schema;
      }
    }

    return schema;
  } catch {
    return DEFAULT_SCHEMA_FILE;
  }
};

const atomicSave = async (data: SchemaFile): Promise<void> => {
  await fetch(SCHEMA_API, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
};

export const saveSchema = (data: SchemaFile): void => {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
  }

  saveTimer = window.setTimeout(() => {
    void atomicSave(data);
  }, 300);
};

export const importSchemaFromFile = (file: File): Promise<SchemaFile> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const schema = sanitizeSchema(parsed);
        resolve(schema);
      } catch (error) {
        reject(
          new Error(
            `Failed to parse JSON file: ${error instanceof Error ? error.message : "Unknown error"}`,
          ),
        );
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
};

export const exportSchemaToFile = (schema: SchemaFile, filename: string = "schema.json"): void => {
  const dataStr = JSON.stringify(schema, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
