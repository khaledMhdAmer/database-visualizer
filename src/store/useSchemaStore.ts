import { create } from "zustand";
import { loadSchema, saveSchema, importSchemaFromFile, exportSchemaToFile } from "../persistence/jsonStorage";
import { applyFkAutoAdd } from "../utils/fkAutoAdd";
import type { Column, ColumnType, DatabaseSchema, Relationship, SchemaFile, Table } from "../types/schema";

type ConnectionPayload = {
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId?: string;
  foreignKeyName?: string;
};

interface SchemaStore {
  schema: SchemaFile;
  initialized: boolean;
  initialize: () => void;
  createDatabase: (name?: string) => string;
  renameDatabase: (databaseId: string, name: string) => void;
  deleteDatabase: (databaseId: string) => void;
  addTable: (databaseId: string, name?: string) => void;
  renameTable: (databaseId: string, tableId: string, name: string) => void;
  deleteTable: (databaseId: string, tableId: string) => void;
  addColumn: (databaseId: string, tableId: string) => void;
  updateColumn: (
    databaseId: string,
    tableId: string,
    columnId: string,
    patch: Partial<Column>,
  ) => void;
  deleteColumn: (databaseId: string, tableId: string, columnId: string) => void;
  upsertRelationshipFromConnection: (databaseId: string, payload: ConnectionPayload) => void;
  deleteRelationship: (databaseId: string, relationshipId: string) => void;
  setTablePosition: (databaseId: string, tableId: string, x: number, y: number) => void;
  setSplitPaneWidth: (databaseId: string, width: number) => void;
  setViewport: (databaseId: string, x: number, y: number, zoom: number) => void;
  getDatabaseById: (databaseId: string) => DatabaseSchema | undefined;
  importFromFile: (file: File) => Promise<void>;
  exportToFile: (filename?: string) => void;
}

const touch = (database: DatabaseSchema): DatabaseSchema => ({
  ...database,
  updatedAt: new Date().toISOString(),
});

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const defaultIdColumn = (): Column => ({
  id: crypto.randomUUID(),
  name: "id",
  type: "INT",
  isPrimaryKey: true,
  isForeignKey: false,
  isNullable: false,
  isUnique: true,
});

const createTable = (name: string): Table => ({
  id: crypto.randomUUID(),
  name,
  columns: [defaultIdColumn()],
});

const persist = (schema: SchemaFile): void => {
  saveSchema(schema);
};

const normalizeLoadedSchema = (schema: SchemaFile): SchemaFile => ({
  ...schema,
  databases: schema.databases.map((database) => {
    const canvasState = database.canvasState;
    const looksUntouchedViewport =
      canvasState.zoom === 1 && canvasState.pan.x === 0 && canvasState.pan.y === 0;

    if (!looksUntouchedViewport) {
      return database;
    }

    return {
      ...database,
      canvasState: {
        ...canvasState,
        zoom: 0.8,
      },
    };
  }),
});

export const useSchemaStore = create<SchemaStore>((set, get) => ({
  schema: { version: 1, databases: [] },
  initialized: false,

  initialize: () => {
    if (get().initialized) {
      return;
    }

    const schema = normalizeLoadedSchema(loadSchema());
    set({ schema, initialized: true });
  },

  createDatabase: (name = "NewDatabase") => {
    const databaseId = crypto.randomUUID();
    set((state) => {
      const next: DatabaseSchema = {
        id: databaseId,
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tables: [],
        relationships: [],
        canvasState: {
          zoom: 0.8,
          pan: { x: 0, y: 0 },
          splitPaneWidth: 50,
          nodePositions: {},
        },
      };

      const schema = {
        ...state.schema,
        databases: [...state.schema.databases, next],
      };

      persist(schema);
      return { schema };
    });

    return databaseId;
  },

  renameDatabase: (databaseId, name) => {
    set((state) => {
      const schema = {
        ...state.schema,
        databases: state.schema.databases.map((database) =>
          database.id === databaseId ? touch({ ...database, name }) : database,
        ),
      };

      persist(schema);
      return { schema };
    });
  },

  deleteDatabase: (databaseId) => {
    set((state) => {
      const schema = {
        ...state.schema,
        databases: state.schema.databases.filter((database) => database.id !== databaseId),
      };

      persist(schema);
      return { schema };
    });
  },

  addTable: (databaseId, name = "NewTable") => {
    set((state) => {
      const schema = {
        ...state.schema,
        databases: state.schema.databases.map((database) => {
          if (database.id !== databaseId) {
            return database;
          }

          const newTable = createTable(name);
          const positionCount = Object.keys(database.canvasState.nodePositions).length;
          const x = 120 + ((positionCount * 40) % 320);
          const y = 80 + positionCount * 30;

          return touch({
            ...database,
            tables: [...database.tables, newTable],
            canvasState: {
              ...database.canvasState,
              nodePositions: {
                ...database.canvasState.nodePositions,
                [newTable.id]: { x, y },
              },
            },
          });
        }),
      };

      persist(schema);
      return { schema };
    });
  },

  renameTable: (databaseId, tableId, name) => {
    set((state) => {
      const schema = {
        ...state.schema,
        databases: state.schema.databases.map((database) =>
          database.id === databaseId
            ? touch({
                ...database,
                tables: database.tables.map((table) =>
                  table.id === tableId ? { ...table, name } : table,
                ),
              })
            : database,
        ),
      };

      persist(schema);
      return { schema };
    });
  },

  deleteTable: (databaseId, tableId) => {
    set((state) => {
      const schema = {
        ...state.schema,
        databases: state.schema.databases.map((database) => {
          if (database.id !== databaseId) {
            return database;
          }

          const relationships = database.relationships.filter(
            (relationship) =>
              relationship.sourceTableId !== tableId && relationship.targetTableId !== tableId,
          );

          const nodePositions = { ...database.canvasState.nodePositions };
          delete nodePositions[tableId];

          return touch({
            ...database,
            tables: database.tables.filter((table) => table.id !== tableId),
            relationships,
            canvasState: {
              ...database.canvasState,
              nodePositions,
            },
          });
        }),
      };

      persist(schema);
      return { schema };
    });
  },

  addColumn: (databaseId, tableId) => {
    set((state) => {
      const schema = {
        ...state.schema,
        databases: state.schema.databases.map((database) =>
          database.id === databaseId
            ? touch({
                ...database,
                tables: database.tables.map((table) =>
                  table.id === tableId
                    ? {
                        ...table,
                        columns: [
                          ...table.columns,
                          {
                            id: crypto.randomUUID(),
                            name: `column_${table.columns.length + 1}`,
                            type: "VARCHAR(255)",
                            isPrimaryKey: false,
                            isForeignKey: false,
                            isNullable: true,
                            isUnique: false,
                          },
                        ],
                      }
                    : table,
                ),
              })
            : database,
        ),
      };

      persist(schema);
      return { schema };
    });
  },

  updateColumn: (databaseId, tableId, columnId, patch) => {
    set((state) => {
      const schema = {
        ...state.schema,
        databases: state.schema.databases.map((database) =>
          database.id === databaseId
            ? touch({
                ...database,
                tables: database.tables.map((table) =>
                  table.id === tableId
                    ? {
                        ...table,
                        columns: table.columns.map((column) =>
                          column.id === columnId ? { ...column, ...patch } : column,
                        ),
                      }
                    : table,
                ),
              })
            : database,
        ),
      };

      persist(schema);
      return { schema };
    });
  },

  deleteColumn: (databaseId, tableId, columnId) => {
    set((state) => {
      const schema = {
        ...state.schema,
        databases: state.schema.databases.map((database) => {
          if (database.id !== databaseId) {
            return database;
          }

          return touch({
            ...database,
            tables: database.tables.map((table) =>
              table.id === tableId
                ? {
                    ...table,
                    columns: table.columns.filter((column) => column.id !== columnId || column.isPrimaryKey),
                  }
                : table,
            ),
            relationships: database.relationships.filter(
              (relationship) =>
                relationship.sourceColumnId !== columnId && relationship.targetColumnId !== columnId,
            ),
          });
        }),
      };

      persist(schema);
      return { schema };
    });
  },

  upsertRelationshipFromConnection: (databaseId, payload) => {
    set((state) => {
      const schema = {
        ...state.schema,
        databases: state.schema.databases.map((database) => {
          if (database.id !== databaseId) {
            return database;
          }

          const sourceTable = database.tables.find((table) => table.id === payload.sourceTableId);
          const targetTable = database.tables.find((table) => table.id === payload.targetTableId);
          if (!sourceTable || !targetTable) {
            return database;
          }

          const sourceColumn = sourceTable.columns.find((column) => column.id === payload.sourceColumnId);
          if (!sourceColumn) {
            return database;
          }

          const fkMutation = applyFkAutoAdd({
            sourceTable,
            sourceColumn,
            targetTable,
            preferredFkName: payload.foreignKeyName,
          });

          const relationshipExists = database.relationships.some(
            (relationship) =>
              relationship.sourceTableId === sourceTable.id &&
              relationship.sourceColumnId === sourceColumn.id &&
              relationship.targetTableId === targetTable.id &&
              relationship.targetColumnId === fkMutation.result.fkColumnId,
          );

          const relationship: Relationship = {
            id: crypto.randomUUID(),
            sourceTableId: sourceTable.id,
            sourceColumnId: sourceColumn.id,
            targetTableId: targetTable.id,
            targetColumnId: fkMutation.result.fkColumnId,
            type: "one-to-many",
          };

          return touch({
            ...database,
            tables: database.tables.map((table) =>
              table.id === targetTable.id ? { ...table, columns: fkMutation.targetColumns } : table,
            ),
            relationships: relationshipExists
              ? database.relationships
              : [...database.relationships, relationship],
          });
        }),
      };

      persist(schema);
      return { schema };
    });
  },

  deleteRelationship: (databaseId, relationshipId) => {
    set((state) => {
      const schema = {
        ...state.schema,
        databases: state.schema.databases.map((database) =>
          database.id === databaseId
            ? touch({
                ...database,
                relationships: database.relationships.filter(
                  (relationship) => relationship.id !== relationshipId,
                ),
              })
            : database,
        ),
      };

      persist(schema);
      return { schema };
    });
  },

  setTablePosition: (databaseId, tableId, x, y) => {
    set((state) => {
      const schema = {
        ...state.schema,
        databases: state.schema.databases.map((database) =>
          database.id === databaseId
            ? touch({
                ...database,
                canvasState: {
                  ...database.canvasState,
                  nodePositions: {
                    ...database.canvasState.nodePositions,
                    [tableId]: { x, y },
                  },
                },
              })
            : database,
        ),
      };

      persist(schema);
      return { schema };
    });
  },

  setSplitPaneWidth: (databaseId, width) => {
    set((state) => {
      const schema = {
        ...state.schema,
        databases: state.schema.databases.map((database) =>
          database.id === databaseId
            ? touch({
                ...database,
                canvasState: {
                  ...database.canvasState,
                  splitPaneWidth: clamp(width, 25, 75),
                },
              })
            : database,
        ),
      };

      persist(schema);
      return { schema };
    });
  },

  setViewport: (databaseId, x, y, zoom) => {
    set((state) => {
      const schema = {
        ...state.schema,
        databases: state.schema.databases.map((database) =>
          database.id === databaseId
            ? touch({
                ...database,
                canvasState: {
                  ...database.canvasState,
                  pan: { x, y },
                  zoom,
                },
              })
            : database,
        ),
      };

      persist(schema);
      return { schema };
    });
  },

  getDatabaseById: (databaseId) => get().schema.databases.find((database) => database.id === databaseId),

  importFromFile: async (file: File) => {
    try {
      const importedSchema = await importSchemaFromFile(file);
      set({ schema: importedSchema });
      saveSchema(importedSchema);
    } catch (error) {
      throw error;
    }
  },

  exportToFile: (filename = "schema.json") => {
    const { schema } = get();
    exportSchemaToFile(schema, filename);
  },
}));

export const COLUMN_TYPES: ColumnType[] = [
  "INT",
  "VARCHAR(255)",
  "TEXT",
  "BOOLEAN",
  "FLOAT",
  "UUID",
  "TIMESTAMP",
  "CUSTOM",
];
