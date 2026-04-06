export type ColumnType =
  | "INT"
  | "VARCHAR(255)"
  | "TEXT"
  | "BOOLEAN"
  | "FLOAT"
  | "UUID"
  | "TIMESTAMP"
  | "CUSTOM";

export interface Column {
  id: string;
  name: string;
  type: ColumnType | string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  references?: {
    tableId: string;
    columnId: string;
  };
}

export interface Table {
  id: string;
  name: string;
  columns: Column[];
}

export type RelationshipType = "one-to-many";

export interface Relationship {
  id: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
  type: RelationshipType;
}

export interface CanvasState {
  zoom: number;
  pan: {
    x: number;
    y: number;
  };
  splitPaneWidth: number;
  nodePositions: Record<
    string,
    {
      x: number;
      y: number;
    }
  >;
}

export interface DatabaseSchema {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  tables: Table[];
  relationships: Relationship[];
  canvasState: CanvasState;
}

export interface SchemaFile {
  version: number;
  databases: DatabaseSchema[];
}

export const CURRENT_SCHEMA_VERSION = 1;

export const DEFAULT_SCHEMA_FILE: SchemaFile = {
  version: CURRENT_SCHEMA_VERSION,
  databases: [],
};
