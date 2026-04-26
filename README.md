# Database Visualizer

Database Visualizer is a visual schema design tool for planning database structures without writing SQL first. It lets you create tables and fields in a schema builder, see the result instantly on a live canvas, and define relationships between tables in a fast, visual workflow.

The project is built for designing logical database schemas only. It does not create real databases or run migrations. Its purpose is to make database modeling easier to understand, easier to organize, and faster to iterate on.

## Install And Run

### Prerequisites

- Node.js 20+ and npm

### Steps

1. Clone the repository.
2. Open a terminal in the project root.
3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm run dev
```

5. Open the local URL shown in the terminal (usually http://localhost:5173).

## Data Storage

- The app runs a local API server and stores schema data in MySQL.
- Default connection used by the server:
	- host: `localhost`
	- port: `3306`
	- user: `root`
	- password: empty
	- database: `database_visualizer`
- The database is auto-created on server startup if it does not exist.

You can override connection settings with environment variables:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

## MCP Server

This project includes an MCP server for AI-driven schema generation and edits.

Run it with:

```bash
npm run mcp
```

Exposed tools:

- `list_databases`
- `get_schema`
- `create_database`
- `add_table`
- `add_column`
- `connect_tables`
- `generate_schema_from_prompt`

### Install This Feature

The schema generation feature is included with the MCP server in this project. To install and enable it:

1. Install project dependencies:

```bash
npm install
```

2. Ensure MySQL is running.

3. Start the API server (for schema persistence):

```bash
npm run dev:server
```

4. Start the MCP server in another terminal:

```bash
npm run mcp
```

### Use The Generate Schema Prompt Tool

Call the `generate_schema_from_prompt` MCP tool with one of these modes:

1. Preview mode (no changes written):

```json
{
	"prompt": "Create a CRM schema with users, companies, contacts, and deals",
	"apply": false
}
```

2. Apply mode (writes changes to MySQL):

```json
{
	"prompt": "Create an ecommerce schema with users, products, orders, and order items",
	"databaseName": "ecommerce_ai",
	"apply": true
}
```

Behavior summary:

- `apply: false` returns a draft schema only.
- `apply: true` creates or updates tables, columns, and relationships in the selected database.
