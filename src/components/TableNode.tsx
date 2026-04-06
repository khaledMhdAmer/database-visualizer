import { Handle, Position } from "@xyflow/react";
import type { Table } from "../types/schema";

interface TableNodeData {
  table: Table;
  onAddField: (tableId: string) => void;
  onRenameField: (tableId: string, columnId: string, name: string) => void;
}

interface TableNodeProps {
  data: TableNodeData;
}

export const TableNode = ({ data }: TableNodeProps) => {
  return (
    <div className="table-node">
      <div className="table-node-header">
        <span>{data.table.name}</span>
        <div className="table-node-header-actions">
          <button
            type="button"
            className="table-node-add-field nodrag nopan"
            onClick={() => data.onAddField(data.table.id)}
          >
            + Field
          </button>
        </div>
      </div>
      <div className="table-node-columns">
        {data.table.columns.map((column) => {
          const handleId = `${data.table.id}:${column.id}`;
          return (
            <div className="table-node-column" key={column.id}>
              <Handle
                id={`target-${handleId}`}
                type="target"
                position={Position.Left}
                className="column-handle target"
              />
              <input
                className="column-name-input nodrag nopan"
                value={column.name}
                disabled={column.isPrimaryKey}
                onChange={(event) =>
                  data.onRenameField(data.table.id, column.id, event.target.value)
                }
                aria-label={`Field name ${column.name}`}
              />
              <span className="column-meta">{column.type}</span>
              {column.isPrimaryKey ? <span className="badge badge-pk">PK</span> : null}
              {column.isForeignKey ? <span className="badge badge-fk">FK</span> : null}
              <Handle
                id={`source-${handleId}`}
                type="source"
                position={Position.Right}
                className="column-handle source"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
