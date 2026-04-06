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

- The app runs a local API server and stores schema data in SQLite.
- The SQLite file is created at `db/schema.db`.
- SQLite files in `db` are ignored by Git.
