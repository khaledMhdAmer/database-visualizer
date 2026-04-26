# Database Visualizer

Database Visualizer is a visual schema design tool for planning database structures without writing SQL first. It lets you create tables and fields in a schema builder, see the result instantly on a live canvas, and define relationships between tables in a fast, visual workflow.

The project is built for designing logical database schemas only. It does not create real databases or run migrations. Its purpose is to make database modeling easier to understand, easier to organize, and faster to iterate on.

## Features

- **Visual Schema Designer** - Create tables and columns with a point-and-click interface
- **Live Canvas View** - See your schema as an interactive node graph in real-time
- **Relationship Management** - Define foreign key relationships by connecting columns
- **Import/Export** - Save schemas as JSON files and import them later or share with others
- **Local Storage** - All schemas are saved locally in your browser

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

## Usage

### Creating a Schema

1. Click **Add New Database** to create a new schema
2. In the editor, use the left panel to add tables and columns
3. On the canvas (right panel), drag tables around and connect them with relationships
4. Your changes are automatically saved to browser storage

### Importing a Schema

1. On the landing page, click **Import from JSON**
2. Select a JSON file in the schema format (see [SCHEMA_FORMAT.md](./SCHEMA_FORMAT.md))
3. The imported database will be added to your workspace

### Exporting a Schema

1. On the landing page, click **Export to JSON**
2. A JSON file will download with your current schema
3. Use this file to back up, share, or import into other projects

### Schema Format

For complete details on the JSON schema format, see [SCHEMA_FORMAT.md](./SCHEMA_FORMAT.md).

A sample schema is included in `sample-schema.json` - an e-commerce database with users, products, orders, and order items.

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

### Browser Data And JSON Files

- Import and export features let you back up and share schemas as JSON files.
- Legacy browser localStorage data can be migrated into the server-backed storage from the landing page.
- If you still have old local-only schemas, run migration once after starting the server.

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
