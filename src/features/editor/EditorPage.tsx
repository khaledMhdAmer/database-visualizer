import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { BlueprintCanvas } from "./BlueprintCanvas";
import { SchemaBuilder } from "./SchemaBuilder";
import { useSchemaStore } from "../../store/useSchemaStore";

export const EditorPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [resizing, setResizing] = useState(false);

  const database = useSchemaStore((state) => (id ? state.getDatabaseById(id) : undefined));
  const renameDatabase = useSchemaStore((state) => state.renameDatabase);
  const setSplitPaneWidth = useSchemaStore((state) => state.setSplitPaneWidth);

  const splitPaneWidth = useMemo(() => database?.canvasState.splitPaneWidth ?? 50, [database]);

  if (!id || !database) {
    return <Navigate to="/" replace />;
  }

  const onMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!resizing) {
      return;
    }

    const parentBounds = event.currentTarget.getBoundingClientRect();
    const widthPercent = ((event.clientX - parentBounds.left) / parentBounds.width) * 100;
    setSplitPaneWidth(id, widthPercent);
  };

  return (
    <main className="editor-page" onMouseMove={onMouseMove} onMouseUp={() => setResizing(false)}>
      <header className="editor-header">
        <button type="button" onClick={() => navigate("/")}>
          Back
        </button>
        <input
          value={database.name}
          onChange={(event) => renameDatabase(database.id, event.target.value)}
          className="database-title-input"
        />
      </header>

      <section className="editor-body">
        <div className="left-pane" style={{ width: `${splitPaneWidth}%` }}>
          <SchemaBuilder databaseId={id} />
        </div>

        <button
          className="splitter"
          type="button"
          onMouseDown={() => setResizing(true)}
          aria-label="Resize panes"
        />

        <div className="right-pane" style={{ width: `${100 - splitPaneWidth}%` }}>
          <BlueprintCanvas databaseId={id} />
        </div>
      </section>
    </main>
  );
};
