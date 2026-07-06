# Practical Task — Backend Engineer

**Time:** 60 minutes ·
**Tools:** any language, framework, database, and AI assistant you like ·
**Format:** share your screen and talk through your thinking as you go — we care about *how* you reason, not just the final code.

We'll start by **talking through how you'd design this**, then you'll **build a slice of it**.

---

## What you're given

A ready-made **Strapi 5** CMS — clone and run it (no schema to build, no database to install; it seeds itself on first boot):

```bash
git clone https://github.com/PatchLord/interview-strapi
cd interview-strapi
cp .env.example .env
bun install        # or npm install
bun run develop    # or npm run develop
```

It comes up at `http://localhost:1337` — admin panel at `/admin` (login `interviewer@local.dev` / `Interview@2026`). The content model + sample data below are already there. **You don't build the CMS — you build the API service in front of it.**

## What to build

A backend service (your own API layer that calls Strapi under the hood) exposing **two endpoints**:
1. a **Product detail** API
2. a **Product list** API with **filters**

## The goal (both endpoints)
- handle roughly **1,000 requests/second** at the **lowest latency you can**
- keep data **as real-time/fresh as possible** — when someone edits content in Strapi (a product, a collection, or a relationship), that change should show up **quickly**
- **production-quality** — something you'd be comfortable putting under real traffic

## What we care about most — please read
We care most about your **reasoning on making this fast *and* fresh at ~1000 req/s** — **prioritize being able to talk through that architecture over finishing every endpoint.** Specifically:
- A **stubbed or described cache is completely fine** — you do **not** need a finished caching layer.
- You do **not** need to actually hit 1000 req/s live — treat it as a target to *reason about*.
- If you run out of time, just tell us what you'd do next.

---

## The content model (already built for you)

**`collection`** (collection type) — `title` (Text), `handle` (UID), `description` (Text), `products` (Relation, **many-to-many** with `product`)

**`product`** (collection type)
| Field | Type | Notes |
|---|---|---|
| `title` | Text | |
| `handle` | UID | unique slug |
| `price` | Number (decimal) | |
| `description` | Text | |
| `collections` | Relation | **many-to-many** with `collection` |
| `details` | Component (`product.details`, single) | see below |
| `recommended` | Component (`product.recommended`, **repeatable**) | see below |

**`product.details`** (component) — `sku` (Text), `material` (Text), `spec` (Component `product.spec`, single — **a component nested inside this component**)

**`product.spec`** (component, nested inside `details`) — `warranty` (Text), `weightGrams` (Integer)

**`product.recommended`** (repeatable component on `product`) — `label` (Text), `collection` (Relation → **one** `collection`)

### Relationship summary
- `product` ⇄ `collection` — **many-to-many**
- `product.details.spec` — a component **nested two levels deep**, scalar fields only
- `product.recommended[].collection` → `collection` — a relation **inside a repeatable component**

### Worth knowing about the Strapi API (you call it from your service)
- REST under `/api/...`; GraphQL at `/graphql` (enabled).
- **Relations & components are NOT returned by default** — you must `populate` them, and **nested** ones need **deep** populate. Example — a product with *everything*, including the recommended collections expanded to their products (for the cards):
  ```
  GET /api/products/:id?populate[collections]=true&populate[details][populate][spec]=true&populate[recommended][populate][collection][populate][products]=true
  ```
  A clean **two-query** approach (fetch the product, then batch-fetch the recommended collections' products) is **equally acceptable** — your call.
- Decide how your service reads from Strapi (the public read role is already enabled, or you can use a token) — your call.

---

## The two APIs to build

Build these on **your own service** (it can call Strapi under the hood — you're not just re-exposing Strapi's raw endpoints).

### API 1 — Product detail
Return a **single product** (by `handle` or `id` — your choice) with its related data **embedded**:
- its `collections`
- its `details`, including the nested `spec`
- its `recommended[]` entries — each with its `collection`, **and that collection expanded to the products inside it, rendered as product cards** (a *product card* = `title`, `handle`, `price`)

### API 2 — Product list (with filters)
Return a **list of products**, supporting at least:
- **filter by collection**
- **filter by price range** (min / max)
- **sort** (e.g. by price or title)
- **pagination**

Return enough related data per product to render a listing (at minimum each product's collections — depth is your call).

---

There's no single "correct" solution — talk us through your tradeoffs, and if you run out of time, tell us what you'd do next.

Good luck — and think out loud!
