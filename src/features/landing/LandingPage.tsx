import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSchemaStore } from "../../store/useSchemaStore";

export const LandingPage = () => {
  const navigate = useNavigate();
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const databases = useSchemaStore((state) => state.schema.databases);
  const createDatabase = useSchemaStore((state) => state.createDatabase);
  const renameDatabase = useSchemaStore((state) => state.renameDatabase);
  const deleteDatabase = useSchemaStore((state) => state.deleteDatabase);

  const sortedDatabases = useMemo(
    () => [...databases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [databases],
  );

  const onCreate = () => {
    const id = createDatabase(`Database_${databases.length + 1}`);
    navigate(`/database/${id}`);
  };

  return (
    <main className="landing-page">
      <header className="landing-header">
        <h1>Blueprint Schema Designer</h1>
        <p>Design logical database schemas as a live node graph.</p>
        <button className="primary-btn" onClick={onCreate} type="button">
          Add New Database
        </button>
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
