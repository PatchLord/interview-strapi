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
    'api::brand.brand.find',
    'api::brand.brand.findOne',
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
 *   - brands
 *   - collections (many-to-many with products)
 *   - products, each embedding a `details` component whose `brand` relation
 *     points at a brand, and each linked to one or more collections.
 */
async function seed(strapi: Core.Strapi) {
  const existing = await strapi.documents('api::product.product').count();
  if (existing > 0) {
    strapi.log.info(`[seed] ${existing} products already present — skipping seed.`);
    return;
  }

  strapi.log.info('[seed] seeding brands, collections and products…');

  const brandDefs = [
    { name: 'Acme', handle: 'acme' },
    { name: 'Zenith', handle: 'zenith' },
    { name: 'Nova', handle: 'nova' },
  ];
  const brands: Record<string, string> = {};
  for (const b of brandDefs) {
    const doc = await strapi.documents('api::brand.brand').create({
      data: b,
      status: 'published',
    });
    brands[b.handle] = doc.documentId;
  }

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
    { title: 'Aurora Hoodie', price: 79.99, material: 'Organic cotton', brand: 'acme', cols: ['new-arrivals', 'best-sellers'] },
    { title: 'Nimbus Rain Jacket', price: 129.0, material: 'Recycled nylon', brand: 'zenith', cols: ['new-arrivals'] },
    { title: 'Terra Sneakers', price: 99.5, material: 'Suede', brand: 'nova', cols: ['best-sellers', 'summer-sale'] },
    { title: 'Solstice Tee', price: 24.99, material: 'Cotton', brand: 'acme', cols: ['summer-sale', 'clearance'] },
    { title: 'Vertex Backpack', price: 64.0, material: 'Ripstop', brand: 'zenith', cols: ['best-sellers'] },
    { title: 'Halcyon Shorts', price: 39.99, material: 'Linen blend', brand: 'nova', cols: ['summer-sale'] },
    { title: 'Onyx Beanie', price: 19.99, material: 'Merino wool', brand: 'acme', cols: ['clearance'] },
    { title: 'Pulse Running Socks', price: 12.5, material: 'Coolmax', brand: 'nova', cols: ['clearance', 'best-sellers'] },
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
          brand: { connect: [brands[p.brand]] },
        },
      },
      status: 'published',
    });
  }

  strapi.log.info(
    `[seed] done: ${brandDefs.length} brands, ${collectionDefs.length} collections, ${productDefs.length} products.`
  );
}

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await openPublicReadAccess(strapi);
    await seed(strapi);
  },
};
