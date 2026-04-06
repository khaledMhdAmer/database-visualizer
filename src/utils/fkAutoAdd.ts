import type { Column, Table } from "../types/schema";

interface FkAutoAddInput {
  sourceTable: Table;
  sourceColumn: Column;
  targetTable: Table;
  preferredFkName?: string;
}

export interface FkAutoAddResult {
  fkColumnId: string;
  wasAutoCreated: boolean;
  finalName: string;
  note?: string;
}

const toPascalCase = (value: string): string =>
  value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");

const isCompatibleFkType = (sourceType: string, targetType: string): boolean => sourceType === targetType;

export const findAvailableFkName = (table: Table, baseName: string): string => {
  if (!table.columns.some((column) => column.name === baseName)) {
    return baseName;
  }

  let index = 2;
  while (table.columns.some((column) => column.name === `${baseName}${index}`)) {
    index += 1;
  }

  return `${baseName}${index}`;
};

export const applyFkAutoAdd = ({
  sourceTable,
  sourceColumn,
  targetTable,
  preferredFkName,
}: FkAutoAddInput): {
  targetColumns: Column[];
  result: FkAutoAddResult;
} => {
  const expectedName = preferredFkName?.trim() || `${toPascalCase(sourceTable.name)}Id`;
  const existing = targetTable.columns.find((column) => column.name === expectedName);

  if (existing) {
    const updated = {
      ...existing,
      isForeignKey: true,
      references: {
        tableId: sourceTable.id,
        columnId: sourceColumn.id,
      },
    };

    if (!isCompatibleFkType(sourceColumn.type, existing.type)) {
      const fallbackName = findAvailableFkName(targetTable, expectedName);
      const newColumn: Column = {
        id: crypto.randomUUID(),
        name: fallbackName,
        type: sourceColumn.type,
        isPrimaryKey: false,
        isForeignKey: true,
        isNullable: false,
        isUnique: false,
        references: {
          tableId: sourceTable.id,
          columnId: sourceColumn.id,
        },
      };

      return {
        targetColumns: [...targetTable.columns, newColumn],
        result: {
          fkColumnId: newColumn.id,
          wasAutoCreated: true,
          finalName: fallbackName,
          note: "Name collision resolved by creating a numbered FK column.",
        },
      };
    }

    return {
      targetColumns: targetTable.columns.map((column) =>
        column.id === existing.id ? updated : column,
      ),
      result: {
        fkColumnId: existing.id,
        wasAutoCreated: false,
        finalName: existing.name,
      },
    };
  }

  const newColumn: Column = {
    id: crypto.randomUUID(),
    name: expectedName,
    type: sourceColumn.type,
    isPrimaryKey: false,
    isForeignKey: true,
    isNullable: false,
    isUnique: false,
    references: {
      tableId: sourceTable.id,
      columnId: sourceColumn.id,
    },
  };

  return {
    targetColumns: [...targetTable.columns, newColumn],
    result: {
      fkColumnId: newColumn.id,
      wasAutoCreated: true,
      finalName: expectedName,
    },
  };
};
