import { useMemo, useState } from "react";
import { useSchemaStore } from "../../store/useSchemaStore";

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
    <path
      d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"
      fill="currentColor"
    />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
    <path
      d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 1 0-1.4 1.4l4.9 4.9-4.9 4.9a1 1 0 1 0 1.4 1.4l4.9-4.9 4.9 4.9a1 1 0 0 0 1.4-1.4l-4.9-4.9 4.9-4.9a1 1 0 0 0 0-1.4z"
      fill="currentColor"
    />
  </svg>
);

const FIELD_TYPE_OPTIONS = [
  { value: "VARCHAR(255)", label: "Short text" },
  { value: "TEXT", label: "Long text" },
  { value: "INT", label: "Number" },
  { value: "FLOAT", label: "Decimal number" },
  { value: "BOOLEAN", label: "Yes / No" },
  { value: "TIMESTAMP", label: "Date & time" },
  { value: "UUID", label: "Unique ID" },
  { value: "CUSTOM", label: "Custom" },
];

interface SchemaBuilderProps {
  databaseId: string;
}

export const SchemaBuilder = ({ databaseId }: SchemaBuilderProps) => {
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<string[]>([]);
  const database = useSchemaStore((state) => state.getDatabaseById(databaseId));
  const addTable = useSchemaStore((state) => state.addTable);
  const renameTable = useSchemaStore((state) => state.renameTable);
  const deleteTable = useSchemaStore((state) => state.deleteTable);
  const addColumn = useSchemaStore((state) => state.addColumn);
  const updateColumn = useSchemaStore((state) => state.updateColumn);
  const deleteColumn = useSchemaStore((state) => state.deleteColumn);

  const duplicateTableNames = useMemo(() => {
    const duplicates = new Set<string>();
    const seen = new Set<string>();

    (database?.tables ?? []).forEach((table) => {
      const lowered = table.name.trim().toLowerCase();
      if (seen.has(lowered)) {
        duplicates.add(lowered);
      }
      seen.add(lowered);
    });

    return duplicates;
  }, [database?.tables]);

  if (!database) {
    return null;
  }

  const toggleSection = (tableId: string) => {
    setCollapsedSectionIds((previous) =>
      previous.includes(tableId)
        ? previous.filter((id) => id !== tableId)
        : [...previous, tableId],
    );
  };

  return (
    <section className="schema-builder">
      <div className="pane-title-row">
        <h2>Design Your Data Form</h2>
        <button type="button" onClick={() => addTable(databaseId, `Table_${database.tables.length + 1}`)}>
          Add Table
        </button>
      </div>

      <div className="table-editor-list">
        {database.tables.map((table) => {
          const duplicateName = duplicateTableNames.has(table.name.trim().toLowerCase());
          const isCollapsed = collapsedSectionIds.includes(table.id);

          return (
            <article key={table.id} className="table-editor-card">
              <div className="table-editor-header">
                <div className="table-row">
                  <input
                    value={table.name}
                    onChange={(event) => renameTable(databaseId, table.id, event.target.value)}
                    className={duplicateName ? "invalid" : ""}
                    placeholder="Table name (example: Users, Businesses)"
                  />
                  <button type="button" onClick={() => addColumn(databaseId, table.id)}>
                    + Field
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger table-remove-btn"
                    onClick={() => deleteTable(databaseId, table.id)}
                    aria-label="Delete table"
                    title="Delete table"
                  >
                    <TrashIcon />
                  </button>
                  <button
                    type="button"
                    className="section-collapse-toggle"
                    onClick={() => toggleSection(table.id)}
                    aria-label={isCollapsed ? "Expand section" : "Collapse section"}
                  >
                    {isCollapsed ? "+" : "-"}
                  </button>
                </div>

                {duplicateName ? <small className="error-text">This table name is already used.</small> : null}
              </div>

              <div className={`table-editor-body ${isCollapsed ? "is-collapsed" : ""}`}>
                <div className="column-list">
                  {table.columns.map((column) => {
                    const duplicateColumn =
                      table.columns.filter(
                        (candidate) =>
                          candidate.name.trim().toLowerCase() === column.name.trim().toLowerCase(),
                      ).length > 1;

                    return (
                      <div className="column-row" key={column.id}>
                        <input
                          value={column.name}
                          onChange={(event) =>
                            updateColumn(databaseId, table.id, column.id, { name: event.target.value })
                          }
                          className={duplicateColumn ? "invalid" : ""}
                          disabled={column.isPrimaryKey}
                          placeholder="Field name"
                        />
                        <select
                          value={column.type}
                          onChange={(event) =>
                            updateColumn(databaseId, table.id, column.id, {
                              type: event.target.value,
                            })
                          }
                        >
                          {FIELD_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="icon-btn danger"
                          disabled={column.isPrimaryKey}
                          onClick={() => deleteColumn(databaseId, table.id, column.id)}
                          aria-label="Delete field"
                          title="Delete field"
                        >
                          <CloseIcon />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
