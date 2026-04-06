import { useMemo, useState } from "react";
import { useSchemaStore } from "../../store/useSchemaStore";

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
        <button type="button" onClick={() => addTable(databaseId, `Section_${database.tables.length + 1}`)}>
          Add Section
        </button>
      </div>

      <div className="table-editor-list">
        {database.tables.map((table) => {
          const duplicateName = duplicateTableNames.has(table.name.trim().toLowerCase());
          const isCollapsed = collapsedSectionIds.includes(table.id);

          return (
            <article key={table.id} className="table-editor-card">
              <div className="table-row">
                <button
                  type="button"
                  className="section-collapse-toggle"
                  onClick={() => toggleSection(table.id)}
                  aria-label={isCollapsed ? "Expand section" : "Collapse section"}
                >
                  {isCollapsed ? "+" : "-"}
                </button>
                <input
                  value={table.name}
                  onChange={(event) => renameTable(databaseId, table.id, event.target.value)}
                  className={duplicateName ? "invalid" : ""}
                  placeholder="Section name (example: Users, Businesses)"
                />
                <button type="button" onClick={() => addColumn(databaseId, table.id)}>
                  + Field
                </button>
                <button type="button" className="danger" onClick={() => deleteTable(databaseId, table.id)}>
                  Remove Section
                </button>
              </div>

              {duplicateName ? <small className="error-text">This section name is already used.</small> : null}

              <div className={`column-list ${isCollapsed ? "is-collapsed" : ""}`}>
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
                      <label>
                        <input
                          type="checkbox"
                          checked={column.isNullable}
                          onChange={(event) =>
                            updateColumn(databaseId, table.id, column.id, {
                              isNullable: event.target.checked,
                            })
                          }
                          disabled={column.isPrimaryKey}
                        />
                        optional
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={column.isUnique}
                          onChange={(event) =>
                            updateColumn(databaseId, table.id, column.id, {
                              isUnique: event.target.checked,
                            })
                          }
                        />
                        no duplicates
                      </label>
                      <button
                        type="button"
                        className="danger"
                        disabled={column.isPrimaryKey}
                        onClick={() => deleteColumn(databaseId, table.id, column.id)}
                      >
                        Remove Field
                      </button>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
