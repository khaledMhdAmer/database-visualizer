import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSchemaStore } from "../../store/useSchemaStore";

export const LandingPage = () => {
  const navigate = useNavigate();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const databases = useSchemaStore((state) => state.schema.databases);
  const createDatabase = useSchemaStore((state) => state.createDatabase);
  const renameDatabase = useSchemaStore((state) => state.renameDatabase);
  const deleteDatabase = useSchemaStore((state) => state.deleteDatabase);
  const importFromFile = useSchemaStore((state) => state.importFromFile);
  const exportToFile = useSchemaStore((state) => state.exportToFile);

  const sortedDatabases = useMemo(
    () => [...databases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [databases],
  );

  const onCreate = () => {
    const id = createDatabase(`Database_${databases.length + 1}`);
    navigate(`/database/${id}`);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportError(null);
      await importFromFile(file);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to import file");
    }

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExportClick = () => {
    const timestamp = new Date().toISOString().split("T")[0];
    exportToFile(`schema-${timestamp}.json`);
  };

  return (
    <main className="landing-page">
      <header className="landing-header">
        <h1>Blueprint Schema Designer</h1>
        <p>Design logical database schemas as a live node graph.</p>
        <div className="header-buttons">
          <button className="primary-btn" onClick={onCreate} type="button">
            Add New Database
          </button>
          <button className="secondary-btn" onClick={handleImportClick} type="button">
            Import from JSON
          </button>
          <button className="secondary-btn" onClick={handleExportClick} type="button">
            Export to JSON
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          style={{ display: "none" }}
          aria-label="Import JSON file"
        />
        {importError && <div className="error-message">{importError}</div>}
      </header>

      {sortedDatabases.length === 0 ? (
        <section className="empty-state">
          <button type="button" className="big-plus" onClick={onCreate} aria-label="Add database">
            +
          </button>
          <h2>Start your first schema</h2>
          <p>Create a database and begin modeling tables visually.</p>
        </section>
      ) : (
        <section className="database-grid">
          {sortedDatabases.map((database) => (
            <article key={database.id} className="database-card">
              <div className="database-card-main" onClick={() => navigate(`/database/${database.id}`)}>
                {renamingId === database.id ? (
                  <input
                    className="database-name-input"
                    value={database.name}
                    onChange={(event) => renameDatabase(database.id, event.target.value)}
                    onBlur={() => setRenamingId(null)}
                    autoFocus
                  />
                ) : (
                  <h3>{database.name}</h3>
                )}
                <p>{database.tables.length} tables</p>
                <small>{new Date(database.updatedAt).toLocaleString()}</small>
              </div>
              <div className="database-card-actions">
                <button type="button" onClick={() => setRenamingId(database.id)}>
                  Rename
                </button>
                <button type="button" className="danger" onClick={() => deleteDatabase(database.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
};
