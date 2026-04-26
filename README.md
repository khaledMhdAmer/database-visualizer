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

- The app stores schema data in browser localStorage
- All data persists locally on your device
- No server or external storage is required
- Clearing browser data will delete stored schemas
