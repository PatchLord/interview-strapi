import type { Core } from '@strapi/strapi';

/**
 * Grant the public role read access (find + findOne) to the content types
 * the candidate needs to query, so the API works with no auth token.
 */
async function openPublicReadAccess(strapi: Core.Strapi) {
  const publicRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'public' } });

  if (!publicRole) return;

  const actions = [
    'api::product.product.find',
    'api::product.product.findOne',
    'api::collection.collection.find',
    'api::collection.collection.findOne',
  ];

  for (const action of actions) {
    const existing = await strapi.db
      .query('plugin::users-permissions.permission')
      .findOne({ where: { action, role: publicRole.id } });

    if (!existing) {
      await strapi.db.query('plugin::users-permissions.permission').create({
        data: { action, role: publicRole.id },
      });
    }
  }
}

/**
 * Seed a small, relation-rich dataset once (idempotent — skips if products exist):
 *   - collections
 *   - products, each linked to one or more collections (many-to-many), plus:
 *       • details.spec  (a component nested inside a component — 2 levels deep,
 *         scalar only, no relation)
 *       • recommended[] → each entry's `collection` → collection  (repeatable
 *         component, each holding a relation to a collection)
 */
async function seed(strapi: Core.Strapi) {
  const existing = await strapi.documents('api::product.product').count({});
  if (existing > 0) {
    strapi.log.info(`[seed] ${existing} products already present — skipping seed.`);
    return;
  }

  strapi.log.info('[seed] seeding collections and products…');

  const collectionDefs = [
    { title: 'Summer Sale', handle: 'summer-sale', description: 'Hot-weather deals.' },
    { title: 'New Arrivals', handle: 'new-arrivals', description: 'Fresh stock.' },
    { title: 'Best Sellers', handle: 'best-sellers', description: 'Most popular items.' },
    { title: 'Clearance', handle: 'clearance', description: 'Final markdowns.' },
  ];
  const collections: Record<string, string> = {};
  for (const c of collectionDefs) {
    const doc = await strapi.documents('api::collection.collection').create({
      data: c,
      status: 'published',
    });
    collections[c.handle] = doc.documentId;
  }

  const productDefs = [
    { title: 'Aurora Hoodie', price: 79.99, material: 'Organic cotton', weight: 640, cols: ['new-arrivals', 'best-sellers'], recommend: ['summer-sale', 'clearance'] },
    { title: 'Nimbus Rain Jacket', price: 129.0, material: 'Recycled nylon', weight: 520, cols: ['new-arrivals'], recommend: ['best-sellers'] },
    { title: 'Terra Sneakers', price: 99.5, material: 'Suede', weight: 780, cols: ['best-sellers', 'summer-sale'], recommend: ['new-arrivals', 'clearance'] },
    { title: 'Solstice Tee', price: 24.99, material: 'Cotton', weight: 180, cols: ['summer-sale', 'clearance'], recommend: ['best-sellers'] },
    { title: 'Vertex Backpack', price: 64.0, material: 'Ripstop', weight: 900, cols: ['best-sellers'], recommend: ['new-arrivals'] },
    { title: 'Halcyon Shorts', price: 39.99, material: 'Linen blend', weight: 210, cols: ['summer-sale'], recommend: ['clearance', 'best-sellers'] },
    { title: 'Onyx Beanie', price: 19.99, material: 'Merino wool', weight: 90, cols: ['clearance'], recommend: ['summer-sale'] },
    { title: 'Pulse Running Socks', price: 12.5, material: 'Coolmax', weight: 60, cols: ['clearance', 'best-sellers'], recommend: ['new-arrivals'] },
  ];

  for (const p of productDefs) {
    await strapi.documents('api::product.product').create({
      data: {
        title: p.title,
        handle: p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        price: p.price,
        description: `${p.title} — a quality product.`,
        collections: { connect: p.cols.map((h) => collections[h]) },
        details: {
          sku: `SKU-${p.title.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)}`,
          material: p.material,
          spec: {
            warranty: '1 year',
            weightGrams: p.weight,
          },
        },
        recommended: p.recommend.map((h, i) => ({
          label: `Because you liked this #${i + 1}`,
          collection: collections[h],
        })),
      },
      status: 'published',
    });
  }

  strapi.log.info(
    `[seed] done: ${collectionDefs.length} collections, ${productDefs.length} products.`
  );
}

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await openPublicReadAccess(strapi);
    await seed(strapi);
  },
};
