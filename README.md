# interview-strapi

A small pre-built **Strapi 5** CMS used as the data source for a backend take-home task.
It comes with the content model + sample data already defined — you just run it.

> 📋 **The task itself is in [TASK.md](./TASK.md).** This repo is only the data source — you build the API service in front of it.

## Run it (≈2 minutes, no database to install)

```bash
bun install
cp .env.example .env      # defaults to SQLite — nothing else to set up
bun run develop
```

Strapi starts at **http://localhost:1337**. On first boot it automatically:
- creates the content types (product, collection + components),
- seeds sample data (6 collections, 30 products — 28 published + 2 draft),
- opens **public read** access (so you can call the API with no token),
- creates an admin user so you can edit content in the panel.

> Prefer npm/yarn/pnpm? Any works — replace `bun` accordingly.

## Access

- **API (REST):** `http://localhost:1337/api/products` , `/api/collections`
- **API (GraphQL):** `http://localhost:1337/graphql`
- **Admin panel:** `http://localhost:1337/admin` — login **interviewer@local.dev** / **Interview@2026**

Relations & components are not returned unless you `populate` them (nested ones need deep populate) — see the task brief for an example.

## Content model (summary)

- `product` ⇄ `collection` — many-to-many
- `product.details` → `spec` — a component nested inside a component (scalar)
- `product.recommended[]` — a repeatable component, each entry with a relation to a `collection`
