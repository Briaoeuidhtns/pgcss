# PGCSS

**The world's first ACID-compliant, transactional styling engine.** 🐘

Stop writing your design system in brittle static files. pgcss brings the power of a full relational DB to your presentation layer, allowing you to manage visual definitions with the same referential integrity you demand from your financial data.
Powered by [PGlite](https://pglite.dev/) (Postgres in WASM), pgcss enables a true **Data-Driven Architecture** for the modern web.

The separation of concerns between "Content" and "Presentation" is a relic of the document-based web. In the application era, style **is** state.

*   🔒 **Transactional Rendering**: Wrap style updates in `BEGIN ... COMMIT` blocks. Eliminate "Flash of Unstyled Content" (FOUC) and partial renders. If the background update commits but the text color fails, the transaction rolls back.
*   📊 **3NF Normalization**: We reject the denormalized nature of standard CSS. pgcss normalizes your stylesheets into Third Normal Form to prevent update anomalies and ensure data consistency.
*   🧩 **Referential Integrity**: Enforce foreign keys between your DOM selectors and your business logic. `JOIN` your `users` table directly to your `declarations` table for data-driven theming.
*   🛡️ **Governance**: Audit your design system using standard SQL `GROUP BY` clauses. Enforce compliance with `CHECK` constraints (e.g., `CONSTRAINT valid_z_index CHECK (value::int < 1000)`).
*   ⚡ **Live Updates**: Styles react instantly to database changes via websockets or logical replication.
*   🎨 **Thematic Control**: Switch between light and dark modes with a single `UPDATE` statement.

## How It Works

pgcss operates on a simple, powerful premise: your styles live in a database.

1.  **Schema**: A lightweight schema is created with two core tables: `selectors` (e.g., `.my-class`, `#my-id`) and `declarations` (e.g., `color: 'red'`). Add it to your existing PGLite db for seamless interactions between your styles and business data
2.  **Reactivity**: Using PGlite's `live` extension, pgcss precisely computes your style changes
4.  **DOM Injection**: When a change is detected, pgcss intelligently updates a target `<style>` element in the DOM. It adds, removes, or modifies CSS rules with minimal overhead.

This approach turns your stylesheet into a reactive, queryable, and robust data solution.

## Usage

### 1. Installation

```bash
npm install pgcss @electric-sql/pglite
```

### 2. Initialization

First, create a PGlite instance with the `live` extension and initialize the pgcss schema.

```typescript
import { PGlite } from '@electric-sql/pglite';
import { initSchema, subscribe } from 'pgcss';
import { live } from '@electric-sql/pglite/live'

// Use the 'live' extension for reactive updates
const db = await PGlite.create({
    extensions: {
        live,
    },
})

// Create the 'selectors' and 'declarations' tables
await initSchema(db);
```

### 3. Add Styles

You can add styles in two ways:

**A) Write SQL Directly**

For dynamic control, write `INSERT` statements yourself. This is perfect for data-driven styles.

```typescript
await db.tx(async (tx) => {
  await tx.exec(`
    INSERT INTO selectors (name) VALUES ('body'), ('.user-avatar')
    ON CONFLICT (name) DO NOTHING;
  `);
  await tx.exec(`
    INSERT INTO declarations (selector_id, property, value) VALUES
      ((SELECT id FROM selectors WHERE name = 'body'), 'background-color', '#f0f0f0'),
      ((SELECT id FROM selectors WHERE name = '.user-avatar'), 'border-radius', '50%');
  `);
});
```

**B) Convert Existing CSS**

If you are burdoned with legacy CSS, use the `cssToPgcss` utility to convert a stylesheet into SQL `INSERT` statements. Experience the styling engine of the future without sacrificing any of your current system.

```typescript
import { cssToPgcss } from 'pgcss';

const myCss = `
  .my-class {
    color: blue;
    font-size: 16px;
  }
  #my-id {
    background-color: #eee;
  }
`;

const sql = cssToPgcss(myCss);
// "INSERT INTO selectors (name) VALUES ('.my-class') ON CONFLICT (name) DO NOTHING;
// INSERT INTO declarations (selector_id, property, value) VALUES ((SELECT id FROM selectors WHERE name = '.my-class'), 'color', 'blue');
// ..."

await db.exec(sql);
```


### 4. Subscribe and Render

Finally, create a `<style>` element and subscribe to changes.

```typescript
// Create a style tag in your document's <head>
const styleEl = document.createElement('style');
styleEl.id = 'pgcss-styles';
document.head.appendChild(styleEl);

// Subscribe to the database and target the new element
const unsubscribe = await pgcss.subscribe(db, {}, styleEl);

// Now, any change to your tables will automatically update the stylesheet!
await db.exec(`
  UPDATE declarations
  SET value = 'red'
  WHERE property = 'color' AND selector_id = (SELECT id FROM selectors WHERE name = '.my-class');
`);

// To stop listening:
// await unsubscribe();
```

## Development

Contributions are welcome!

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/user/pgcss.git
    cd pgcss
    pnpm install
    ```
2.  **Run Tests**:
    ```bash
    pnpm test
    ```
3.  **Build**:
    ```bash
    pnpm build
    ```

## Prior Art

pgcss stands on the shoulders of giants. It is inspired by projects that have challenged the traditional boundaries of styles and data:

*   **TailwindSQL**: Championed utility-first SQL, seamlessly blurring the lines between styles and data

pgcss takes the "styling as data" concept to its logical conclusion, offering a new paradigm for managing complex visual systems with the reliability of a relational database.
