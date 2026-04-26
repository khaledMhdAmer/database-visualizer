import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getSchema, initStore, saveSchema } from "./mysqlStore.mjs";

const normalize = (value) => value.trim().toLowerCase();
const toPascalCase = (value) =>
  value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");

const findDatabaseByName = (schema, name) =>
  schema.databases.find((database) => normalize(database.name) === normalize(name));

const findTableByName = (database, tableName) =>
  database.tables.find((table) => normalize(table.name) === normalize(tableName));

const findAvailableFkName = (table, baseName) => {
  if (!table.columns.some((column) => column.name === baseName)) {
    return baseName;
  }

  let index = 2;
  while (table.columns.some((column) => column.name === `${baseName}${index}`)) {
    index += 1;
  }

  return `${baseName}${index}`;
};

const positionForNewTable = (database) => {
  const tableCount = database.tables.length;
  const cols = 3;
  const col = tableCount % cols;
  const row = Math.floor(tableCount / cols);
  return { x: 24 + col * 340, y: 24 + row * 220 };
};

const toolResult = (value) => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});

const createDatabaseInput = z.object({
  name: z.string().min(1),
});

const addTableInput = z.object({
  databaseName: z.string().min(1),
  tableName: z.string().min(1),
});

const addColumnInput = z.object({
  databaseName: z.string().min(1),
  tableName: z.string().min(1),
  columnName: z.string().min(1),
  type: z.string().optional(),
});

const getSchemaInput = z.object({
  databaseName: z.string().optional(),
});

const connectTablesInput = z.object({
  databaseName: z.string().min(1),
  sourceTable: z.string().min(1),
  targetTable: z.string().min(1),
  sourceColumn: z.string().optional(),
  foreignKeyName: z.string().optional(),
});

const generateSchemaFromPromptInput = z.object({
  prompt: z.string().min(1),
  databaseName: z.string().optional(),
  apply: z.boolean().optional(),
});

const createDatabaseRecord = (name) => {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    tables: [],
    relationships: [],
    canvasState: {
      zoom: 0.8,
      pan: { x: 0, y: 0 },
      splitPaneWidth: 50,
      nodePositions: {},
    },
  };
};

const createColumn = (name, type = "VARCHAR(255)", isNullable = true, isUnique = false) => ({
  id: randomUUID(),
  name,
  type,
  isPrimaryKey: false,
  isForeignKey: false,
  isNullable,
  isUnique,
});

const createIdColumn = () => ({
  id: randomUUID(),
  name: "id",
  type: "INT",
  isPrimaryKey: true,
  isForeignKey: false,
  isNullable: false,
  isUnique: true,
});

const normalizeToken = (value) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const deriveDatabaseName = (prompt) => {
  const base = normalizeToken(prompt).toLowerCase().split("_").slice(0, 3).join("_");
  return (base || "generated_schema") + "_db";
};

const buildPreset = (kind) => {
  if (kind === "crm") {
    return {
      tables: [
        { name: "Users", columns: [createColumn("email", "VARCHAR(255)", false, true), createColumn("fullName", "VARCHAR(255)", false)] },
        { name: "Companies", columns: [createColumn("name", "VARCHAR(255)", false), createColumn("industry")] },
        { name: "Contacts", columns: [createColumn("firstName", "VARCHAR(255)", false), createColumn("lastName", "VARCHAR(255)", false), createColumn("email", "VARCHAR(255)", true, true)] },
        { name: "Deals", columns: [createColumn("title", "VARCHAR(255)", false), createColumn("amount", "FLOAT", false), createColumn("stage", "VARCHAR(255)", false)] },
      ],
      relationships: [
        { sourceTable: "Users", targetTable: "Companies" },
        { sourceTable: "Companies", targetTable: "Contacts" },
        { sourceTable: "Companies", targetTable: "Deals" },
        { sourceTable: "Users", targetTable: "Deals" },
      ],
    };
  }

  if (kind === "ecommerce") {
    return {
      tables: [
        { name: "Users", columns: [createColumn("email", "VARCHAR(255)", false, true), createColumn("fullName", "VARCHAR(255)", false)] },
        { name: "Products", columns: [createColumn("name", "VARCHAR(255)", false), createColumn("price", "FLOAT", false), createColumn("sku", "VARCHAR(255)", false, true)] },
        { name: "Orders", columns: [createColumn("status", "VARCHAR(255)", false), createColumn("totalAmount", "FLOAT", false)] },
        { name: "OrderItems", columns: [createColumn("quantity", "INT", false), createColumn("unitPrice", "FLOAT", false)] },
      ],
      relationships: [
        { sourceTable: "Users", targetTable: "Orders" },
        { sourceTable: "Orders", targetTable: "OrderItems" },
        { sourceTable: "Products", targetTable: "OrderItems" },
      ],
    };
  }

  if (kind === "blog") {
    return {
      tables: [
        { name: "Users", columns: [createColumn("username", "VARCHAR(255)", false, true), createColumn("email", "VARCHAR(255)", false, true)] },
        { name: "Posts", columns: [createColumn("title", "VARCHAR(255)", false), createColumn("content", "TEXT", false), createColumn("publishedAt", "TIMESTAMP")] },
        { name: "Comments", columns: [createColumn("content", "TEXT", false)] },
        { name: "Tags", columns: [createColumn("name", "VARCHAR(255)", false, true)] },
        { name: "PostTags", columns: [] },
      ],
      relationships: [
        { sourceTable: "Users", targetTable: "Posts" },
        { sourceTable: "Users", targetTable: "Comments" },
        { sourceTable: "Posts", targetTable: "Comments" },
        { sourceTable: "Posts", targetTable: "PostTags" },
        { sourceTable: "Tags", targetTable: "PostTags" },
      ],
    };
  }

  return {
    tables: [
      { name: "Users", columns: [createColumn("name", "VARCHAR(255)", false), createColumn("email", "VARCHAR(255)", false, true)] },
      { name: "Projects", columns: [createColumn("name", "VARCHAR(255)", false), createColumn("status", "VARCHAR(255)", false)] },
      { name: "Tasks", columns: [createColumn("title", "VARCHAR(255)", false), createColumn("dueDate", "TIMESTAMP")] },
    ],
    relationships: [
      { sourceTable: "Users", targetTable: "Projects" },
      { sourceTable: "Projects", targetTable: "Tasks" },
      { sourceTable: "Users", targetTable: "Tasks" },
    ],
  };
};

const extractTablesFromPrompt = (prompt) => {
  const match = prompt.match(/tables?\s*:\s*([a-zA-Z0-9_,\s-]+)/i);
  if (!match) {
    return [];
  }

  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => toPascalCase(item));
};

const draftFromPrompt = (prompt) => {
  const lower = prompt.toLowerCase();

  if (lower.includes("crm") || lower.includes("sales")) {
    return buildPreset("crm");
  }

  if (lower.includes("ecommerce") || lower.includes("shop") || lower.includes("store")) {
    return buildPreset("ecommerce");
  }

  if (lower.includes("blog") || lower.includes("content")) {
    return buildPreset("blog");
  }

  const listedTables = extractTablesFromPrompt(prompt);
  if (listedTables.length > 0) {
    return {
      tables: listedTables.map((tableName) => ({
        name: tableName,
        columns: [createColumn("name", "VARCHAR(255)", false)],
      })),
      relationships: listedTables.length > 1
        ? listedTables.slice(1).map((tableName, index) => ({
            sourceTable: listedTables[index],
            targetTable: tableName,
          }))
        : [],
    };
  }

  return buildPreset("default");
};

const server = new Server(
  {
    name: "database-visualizer-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_databases",
      description: "List all databases in the schema store",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_schema",
      description: "Get full schema or a specific database schema",
      inputSchema: {
        type: "object",
        properties: { databaseName: { type: "string" } },
      },
    },
    {
      name: "create_database",
      description: "Create a new database",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
    {
      name: "add_table",
      description: "Add a table to a database",
      inputSchema: {
        type: "object",
        properties: {
          databaseName: { type: "string" },
          tableName: { type: "string" },
        },
        required: ["databaseName", "tableName"],
      },
    },
    {
      name: "add_column",
      description: "Add a column to a table",
      inputSchema: {
        type: "object",
        properties: {
          databaseName: { type: "string" },
          tableName: { type: "string" },
          columnName: { type: "string" },
          type: { type: "string" },
        },
        required: ["databaseName", "tableName", "columnName"],
      },
    },
    {
      name: "connect_tables",
      description: "Connect source table to target table with FK relationship",
      inputSchema: {
        type: "object",
        properties: {
          databaseName: { type: "string" },
          sourceTable: { type: "string" },
          targetTable: { type: "string" },
          sourceColumn: { type: "string" },
          foreignKeyName: { type: "string" },
        },
        required: ["databaseName", "sourceTable", "targetTable"],
      },
    },
    {
      name: "generate_schema_from_prompt",
      description:
        "Generate a database schema draft from a natural language prompt, with optional apply mode",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          databaseName: { type: "string" },
          apply: { type: "boolean" },
        },
        required: ["prompt"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};

  if (name === "list_databases") {
    const schema = await getSchema();
    return toolResult(
      schema.databases.map((database) => ({
        id: database.id,
        name: database.name,
        tableCount: database.tables.length,
        relationshipCount: database.relationships.length,
        updatedAt: database.updatedAt,
      })),
    );
  }

  if (name === "get_schema") {
    const input = getSchemaInput.parse(args);
    const schema = await getSchema();

    if (!input.databaseName) {
      return toolResult(schema);
    }

    const database = findDatabaseByName(schema, input.databaseName);
    if (!database) {
      throw new Error(`Database not found: ${input.databaseName}`);
    }

    return toolResult(database);
  }

  if (name === "create_database") {
    const input = createDatabaseInput.parse(args);
    const schema = await getSchema();

    if (findDatabaseByName(schema, input.name)) {
      throw new Error(`Database already exists: ${input.name}`);
    }

    const database = createDatabaseRecord(input.name);

    const next = {
      ...schema,
      databases: [...schema.databases, database],
    };

    await saveSchema(next);
    return toolResult({ created: database });
  }

  if (name === "add_table") {
    const input = addTableInput.parse(args);
    const schema = await getSchema();
    const database = findDatabaseByName(schema, input.databaseName);

    if (!database) {
      throw new Error(`Database not found: ${input.databaseName}`);
    }

    if (findTableByName(database, input.tableName)) {
      throw new Error(`Table already exists: ${input.tableName}`);
    }

    const table = {
      id: randomUUID(),
      name: input.tableName,
      columns: [
        {
          id: randomUUID(),
          name: "id",
          type: "INT",
          isPrimaryKey: true,
          isForeignKey: false,
          isNullable: false,
          isUnique: true,
        },
      ],
    };

    const position = positionForNewTable(database);
    const nextDatabase = {
      ...database,
      updatedAt: new Date().toISOString(),
      tables: [...database.tables, table],
      canvasState: {
        ...database.canvasState,
        nodePositions: {
          ...database.canvasState.nodePositions,
          [table.id]: position,
        },
      },
    };

    const next = {
      ...schema,
      databases: schema.databases.map((item) => (item.id === database.id ? nextDatabase : item)),
    };

    await saveSchema(next);
    return toolResult({ created: table, position });
  }

  if (name === "add_column") {
    const input = addColumnInput.parse(args);
    const schema = await getSchema();
    const database = findDatabaseByName(schema, input.databaseName);

    if (!database) {
      throw new Error(`Database not found: ${input.databaseName}`);
    }

    const table = findTableByName(database, input.tableName);
    if (!table) {
      throw new Error(`Table not found: ${input.tableName}`);
    }

    const column = {
      id: randomUUID(),
      name: input.columnName,
      type: input.type || "VARCHAR(255)",
      isPrimaryKey: false,
      isForeignKey: false,
      isNullable: true,
      isUnique: false,
    };

    const nextTable = {
      ...table,
      columns: [...table.columns, column],
    };

    const nextDatabase = {
      ...database,
      updatedAt: new Date().toISOString(),
      tables: database.tables.map((item) => (item.id === table.id ? nextTable : item)),
    };

    const next = {
      ...schema,
      databases: schema.databases.map((item) => (item.id === database.id ? nextDatabase : item)),
    };

    await saveSchema(next);
    return toolResult({ created: column });
  }

  if (name === "connect_tables") {
    const input = connectTablesInput.parse(args);
    const schema = await getSchema();
    const database = findDatabaseByName(schema, input.databaseName);

    if (!database) {
      throw new Error(`Database not found: ${input.databaseName}`);
    }

    const sourceTable = findTableByName(database, input.sourceTable);
    const targetTable = findTableByName(database, input.targetTable);

    if (!sourceTable) {
      throw new Error(`Source table not found: ${input.sourceTable}`);
    }

    if (!targetTable) {
      throw new Error(`Target table not found: ${input.targetTable}`);
    }

    const sourceColumnName = input.sourceColumn || "id";
    const sourceColumn = sourceTable.columns.find(
      (column) => normalize(column.name) === normalize(sourceColumnName),
    );

    if (!sourceColumn) {
      throw new Error(`Source column not found: ${sourceColumnName}`);
    }

    const expectedFkName = input.foreignKeyName?.trim() || `${toPascalCase(sourceTable.name)}Id`;
    const existingFk = targetTable.columns.find((column) => column.name === expectedFkName);

    let targetColumns = targetTable.columns;
    let targetFkId;

    if (existingFk) {
      if (existingFk.type === sourceColumn.type) {
        targetFkId = existingFk.id;
        targetColumns = targetColumns.map((column) =>
          column.id === existingFk.id
            ? {
                ...column,
                isForeignKey: true,
                references: { tableId: sourceTable.id, columnId: sourceColumn.id },
              }
            : column,
        );
      } else {
        const fallbackName = findAvailableFkName(targetTable, expectedFkName);
        const fkColumn = {
          id: randomUUID(),
          name: fallbackName,
          type: sourceColumn.type,
          isPrimaryKey: false,
          isForeignKey: true,
          isNullable: false,
          isUnique: false,
          references: { tableId: sourceTable.id, columnId: sourceColumn.id },
        };
        targetFkId = fkColumn.id;
        targetColumns = [...targetColumns, fkColumn];
      }
    } else {
      const fkColumn = {
        id: randomUUID(),
        name: expectedFkName,
        type: sourceColumn.type,
        isPrimaryKey: false,
        isForeignKey: true,
        isNullable: false,
        isUnique: false,
        references: { tableId: sourceTable.id, columnId: sourceColumn.id },
      };
      targetFkId = fkColumn.id;
      targetColumns = [...targetColumns, fkColumn];
    }

    const relationshipExists = database.relationships.some(
      (relationship) =>
        relationship.sourceTableId === sourceTable.id &&
        relationship.sourceColumnId === sourceColumn.id &&
        relationship.targetTableId === targetTable.id &&
        relationship.targetColumnId === targetFkId,
    );

    const relationship = {
      id: randomUUID(),
      sourceTableId: sourceTable.id,
      sourceColumnId: sourceColumn.id,
      targetTableId: targetTable.id,
      targetColumnId: targetFkId,
      type: "one-to-many",
    };

    const nextTargetTable = {
      ...targetTable,
      columns: targetColumns,
    };

    const nextDatabase = {
      ...database,
      updatedAt: new Date().toISOString(),
      tables: database.tables.map((table) =>
        table.id === targetTable.id ? nextTargetTable : table,
      ),
      relationships: relationshipExists
        ? database.relationships
        : [...database.relationships, relationship],
    };

    const next = {
      ...schema,
      databases: schema.databases.map((item) => (item.id === database.id ? nextDatabase : item)),
    };

    await saveSchema(next);
    return toolResult({ connected: !relationshipExists, relationship });
  }

  if (name === "generate_schema_from_prompt") {
    const input = generateSchemaFromPromptInput.parse(args);
    const apply = input.apply ?? false;
    const draft = draftFromPrompt(input.prompt);
    const databaseName = input.databaseName || deriveDatabaseName(input.prompt);

    if (!apply) {
      return toolResult({
        mode: "preview",
        databaseName,
        draft,
      });
    }

    const schema = await getSchema();
    const existingDatabase = findDatabaseByName(schema, databaseName);
    let database = existingDatabase || createDatabaseRecord(databaseName);

    if (!existingDatabase) {
      schema.databases = [...schema.databases, database];
    }

    const tablesBefore = database.tables.length;
    let addedTables = 0;
    let addedColumns = 0;
    let addedRelationships = 0;

    for (const draftTable of draft.tables) {
      let table = findTableByName(database, draftTable.name);

      if (!table) {
        table = {
          id: randomUUID(),
          name: draftTable.name,
          columns: [createIdColumn()],
        };
        database = {
          ...database,
          tables: [...database.tables, table],
          canvasState: {
            ...database.canvasState,
            nodePositions: {
              ...database.canvasState.nodePositions,
              [table.id]: positionForNewTable({ ...database, tables: [...database.tables] }),
            },
          },
        };
        addedTables += 1;
      }

      const columnsToAdd = draftTable.columns.filter(
        (column) => !table.columns.some((existing) => normalize(existing.name) === normalize(column.name)),
      );

      if (columnsToAdd.length > 0) {
        table = {
          ...table,
          columns: [...table.columns, ...columnsToAdd.map((column) => ({ ...column, id: randomUUID() }))],
        };

        database = {
          ...database,
          tables: database.tables.map((candidate) => (candidate.id === table.id ? table : candidate)),
        };

        addedColumns += columnsToAdd.length;
      }
    }

    for (const relation of draft.relationships) {
      const sourceTable = findTableByName(database, relation.sourceTable);
      const targetTable = findTableByName(database, relation.targetTable);

      if (!sourceTable || !targetTable) {
        continue;
      }

      const sourceColumn = sourceTable.columns.find((column) => normalize(column.name) === "id");
      if (!sourceColumn) {
        continue;
      }

      const expectedFkName = relation.foreignKeyName?.trim() || `${toPascalCase(sourceTable.name)}Id`;
      const existingFk = targetTable.columns.find((column) => column.name === expectedFkName);

      let targetColumns = targetTable.columns;
      let targetFkId;

      if (existingFk) {
        if (existingFk.type === sourceColumn.type) {
          targetFkId = existingFk.id;
          targetColumns = targetColumns.map((column) =>
            column.id === existingFk.id
              ? {
                  ...column,
                  isForeignKey: true,
                  references: { tableId: sourceTable.id, columnId: sourceColumn.id },
                }
              : column,
          );
        } else {
          const fallbackName = findAvailableFkName(targetTable, expectedFkName);
          const fkColumn = {
            ...createColumn(fallbackName, sourceColumn.type, false, false),
            isForeignKey: true,
            references: { tableId: sourceTable.id, columnId: sourceColumn.id },
          };
          targetFkId = fkColumn.id;
          targetColumns = [...targetColumns, fkColumn];
          addedColumns += 1;
        }
      } else {
        const fkColumn = {
          ...createColumn(expectedFkName, sourceColumn.type, false, false),
          isForeignKey: true,
          references: { tableId: sourceTable.id, columnId: sourceColumn.id },
        };
        targetFkId = fkColumn.id;
        targetColumns = [...targetColumns, fkColumn];
        addedColumns += 1;
      }

      const relationshipExists = database.relationships.some(
        (relationship) =>
          relationship.sourceTableId === sourceTable.id &&
          relationship.sourceColumnId === sourceColumn.id &&
          relationship.targetTableId === targetTable.id &&
          relationship.targetColumnId === targetFkId,
      );

      const relationship = {
        id: randomUUID(),
        sourceTableId: sourceTable.id,
        sourceColumnId: sourceColumn.id,
        targetTableId: targetTable.id,
        targetColumnId: targetFkId,
        type: "one-to-many",
      };

      database = {
        ...database,
        tables: database.tables.map((table) =>
          table.id === targetTable.id ? { ...table, columns: targetColumns } : table,
        ),
        relationships: relationshipExists
          ? database.relationships
          : [...database.relationships, relationship],
      };

      if (!relationshipExists) {
        addedRelationships += 1;
      }
    }

    database = {
      ...database,
      updatedAt: new Date().toISOString(),
    };

    const next = {
      ...schema,
      databases: schema.databases.map((item) => (item.id === database.id ? database : item)),
    };

    await saveSchema(next);

    return toolResult({
      mode: "applied",
      databaseName: database.name,
      summary: {
        tablesBefore,
        tablesAfter: database.tables.length,
        addedTables,
        addedColumns,
        addedRelationships,
      },
      draft,
    });
  }

  throw new Error(`Unknown tool: ${name}`);
});

const main = async () => {
  await initStore();
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

main().catch((error) => {
  console.error("[mcp] failed to start", error);
  process.exit(1);
});
