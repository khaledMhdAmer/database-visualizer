import {
  Background,
  Connection,
  Controls,
  Edge,
  MiniMap,
  Node,
  NodeChange,
  Panel,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RelationshipEdge } from "../../components/RelationshipEdge";
import { TableNode } from "../../components/TableNode";
import { useSchemaStore } from "../../store/useSchemaStore";

interface BlueprintCanvasProps {
  databaseId: string;
}

const edgeTypes = {
  relationship: RelationshipEdge,
};

const nodeTypes = {
  tableNode: TableNode,
};

const parseHandle = (value?: string | null): { tableId: string; columnId: string } | null => {
  if (!value) {
    return null;
  }

  const chunks = value.split(":");
  if (chunks.length !== 2) {
    return null;
  }

  const [tableIdWithPrefix, columnId] = chunks;
  const tableId = tableIdWithPrefix.replace("source-", "").replace("target-", "");
  return { tableId, columnId };
};

const toPascalCase = (value: string): string =>
  value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");

const sameIds = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
};

const TABLE_LAYOUT = {
  width: 300,
  headerHeight: 52,
  columnRowHeight: 34,
  footerPadding: 16,
  horizontalGap: 40,
  verticalGap: 40,
  padding: 24,
};

const getTableLayoutHeight = (columnCount: number): number =>
  TABLE_LAYOUT.headerHeight + columnCount * TABLE_LAYOUT.columnRowHeight + TABLE_LAYOUT.footerPadding;

export const BlueprintCanvas = ({ databaseId }: BlueprintCanvasProps) => {
  const database = useSchemaStore((state) => state.getDatabaseById(databaseId));
  const addColumn = useSchemaStore((state) => state.addColumn);
  const updateColumn = useSchemaStore((state) => state.updateColumn);
  const setTablePosition = useSchemaStore((state) => state.setTablePosition);
  const setViewport = useSchemaStore((state) => state.setViewport);
  const deleteTable = useSchemaStore((state) => state.deleteTable);
  const deleteRelationship = useSchemaStore((state) => state.deleteRelationship);
  const upsertRelationshipFromConnection = useSchemaStore(
    (state) => state.upsertRelationshipFromConnection,
  );
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const canvasRootRef = useRef<HTMLDivElement>(null);

  const autoOrganize = useCallback(() => {
    if (!database) {
      return;
    }

    const zoom = database.canvasState.zoom ?? 0.8;
    const containerWidth = canvasRootRef.current?.clientWidth ?? 800;
    const flowWidth = containerWidth / zoom;
    const cols = Math.max(
      1,
      Math.floor(
        (flowWidth - TABLE_LAYOUT.padding * 2) / (TABLE_LAYOUT.width + TABLE_LAYOUT.horizontalGap),
      ),
    );

    let currentRowTop = TABLE_LAYOUT.padding;

    database.tables.forEach((table, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      if (col === 0 && row > 0) {
        const previousRow = database.tables.slice((row - 1) * cols, row * cols);
        const previousRowHeight = Math.max(
          ...previousRow.map((rowTable) => getTableLayoutHeight(rowTable.columns.length)),
        );
        currentRowTop += previousRowHeight + TABLE_LAYOUT.verticalGap;
      }

      const x =
        TABLE_LAYOUT.padding + col * (TABLE_LAYOUT.width + TABLE_LAYOUT.horizontalGap);
      const y = currentRowTop;
      setTablePosition(databaseId, table.id, x, y);
    });
  }, [database, databaseId, setTablePosition]);

  const nodes = useMemo<Node[]>(() => {
    if (!database) {
      return [];
    }

    return database.tables.map((table) => ({
      id: table.id,
      type: "tableNode",
      data: {
        table,
        onAddField: (tableId: string) => addColumn(databaseId, tableId),
        onRenameField: (tableId: string, columnId: string, name: string) =>
          updateColumn(databaseId, tableId, columnId, { name }),
      },
      position: database.canvasState.nodePositions[table.id] ?? { x: 100, y: 120 },
    }));
  }, [addColumn, database, databaseId, updateColumn]);

  const edges = useMemo<Edge[]>(() => {
    if (!database) {
      return [];
    }

    return database.relationships.map((relationship) => ({
      id: relationship.id,
      source: relationship.sourceTableId,
      sourceHandle: `source-${relationship.sourceTableId}:${relationship.sourceColumnId}`,
      target: relationship.targetTableId,
      targetHandle: `target-${relationship.targetTableId}:${relationship.targetColumnId}`,
      type: "relationship",
      animated: true,
    }));
  }, [database]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!database) {
        return;
      }

      const source = parseHandle(connection.sourceHandle);
      const target = parseHandle(connection.targetHandle);

      if (!source || !target || source.tableId === target.tableId) {
        return;
      }

      const sourceTable = database.tables.find((table) => table.id === source.tableId);
      if (!sourceTable) {
        return;
      }

      const suggestedForeignKeyName = `${toPascalCase(sourceTable.name)}Id`;
      const promptResult = window.prompt(
        `Column name on the target section (example: ownerId):`,
        suggestedForeignKeyName,
      );

      if (promptResult === null) {
        return;
      }

      const foreignKeyName = promptResult.trim() || undefined;

      upsertRelationshipFromConnection(databaseId, {
        sourceTableId: source.tableId,
        sourceColumnId: source.columnId,
        targetTableId: target.tableId,
        targetColumnId: target.columnId,
        foreignKeyName,
      });
    },
    [database, databaseId, upsertRelationshipFromConnection],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      changes.forEach((change) => {
        if (change.type !== "position" || !change.position || change.dragging) {
          return;
        }

        setTablePosition(databaseId, change.id, change.position.x, change.position.y);
      });
    },
    [databaseId, setTablePosition],
  );

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[]; edges: Edge[] }) => {
      const nextNodeIds = selectedNodes.map((node) => node.id);
      const nextEdgeIds = selectedEdges.map((edge) => edge.id);

      setSelectedNodeIds((previous) => (sameIds(previous, nextNodeIds) ? previous : nextNodeIds));
      setSelectedEdgeIds((previous) => (sameIds(previous, nextEdgeIds) ? previous : nextEdgeIds));
    },
    [],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.tagName === "SELECT" ||
          activeElement.isContentEditable)
      ) {
        return;
      }

      if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) {
        return;
      }

      event.preventDefault();

      const tableText =
        selectedNodeIds.length > 0
          ? `${selectedNodeIds.length} table${selectedNodeIds.length > 1 ? "s" : ""}`
          : "";
      const relationshipText =
        selectedEdgeIds.length > 0
          ? `${selectedEdgeIds.length} relationship${selectedEdgeIds.length > 1 ? "s" : ""}`
          : "";
      const summary = [tableText, relationshipText].filter(Boolean).join(" and ");

      const confirmed = window.confirm(`Delete selected ${summary}?`);
      if (!confirmed) {
        return;
      }

      selectedNodeIds.forEach((tableId) => deleteTable(databaseId, tableId));
      selectedEdgeIds.forEach((relationshipId) => deleteRelationship(databaseId, relationshipId));
      setSelectedNodeIds([]);
      setSelectedEdgeIds([]);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [databaseId, deleteRelationship, deleteTable, selectedEdgeIds, selectedNodeIds]);

  if (!database) {
    return null;
  }

  return (
    <div className="canvas-root" ref={canvasRootRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onSelectionChange={onSelectionChange}
        onConnect={onConnect}
        panOnDrag={[1]}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={{
          x: database.canvasState.pan.x,
          y: database.canvasState.pan.y,
          zoom: database.canvasState.zoom || 0.8,
        }}
        onMoveEnd={(_, viewport) => setViewport(databaseId, viewport.x, viewport.y, viewport.zoom)}
      >
        <Background gap={18} size={1} color="var(--grid-line)" />
        <Controls />
        <MiniMap pannable zoomable />
        <Panel position="top-right">
          <button
            type="button"
            className="canvas-organize-btn"
            onClick={autoOrganize}
            title="Auto-organize tables into a grid"
          >
            Auto Organize
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
};
