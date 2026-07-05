import type { Core } from '@strapi/strapi';

/**
 * Create a super-admin user once (idempotent) so whoever boots this (the
 * candidate on their laptop, or the interviewer) can log into /admin and edit
 * content live — needed to demonstrate the "real-time freshness" requirement.
 * Overridable via SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 *
 * Default login:  interviewer@local.dev  /  Interview@2026
 */
async function createAdminUser(strapi: Core.Strapi) {
  const count = await strapi.db.query('admin::user').count();
  if (count > 0) {
    strapi.log.info('[seed] admin user already exists — skipping.');
    return;
  }

  const superAdmin = await strapi.db
    .query('admin::role')
    .findOne({ where: { code: 'strapi-super-admin' } });

  if (!superAdmin) {
    strapi.log.warn('[seed] super-admin role not found yet — skipping admin creation.');
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL || 'interviewer@local.dev';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Interview@2026';

  await strapi.service('admin::user').create({
    email,
    firstname: 'Interviewer',
    lastname: 'Admin',
    password,
    isActive: true,
    roles: [superAdmin.id],
  });

  strapi.log.info(`[seed] admin user created → ${email}`);
}

/**
 * Grant the public role read access (find + findOne) so a client service can
 * read from Strapi with no token.
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
      await strapi.db
        .query('plugin::users-permissions.permission')
        .create({ data: { action, role: publicRole.id } });
    }
  }
}

/**
 * Seed a relation-rich dataset once (idempotent — skips if products exist):
 *   - 6 collections
 *   - 30 products (28 published + 2 draft/unpublished, to exercise the
 *     published-only path), each wired through:
 *       • collections (many-to-many)
 *       • details.spec  (component nested inside a component — scalar)
 *       • recommended[] → each entry's collection  (relation in a repeatable
 *         component; the collection has its own products for the "cards")
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
    { title: 'Featured', handle: 'featured', description: 'Hand-picked highlights.' },
    { title: 'Essentials', handle: 'essentials', description: 'Everyday staples.' },
  ];
  const colByHandle: Record<string, string> = {};
  for (const c of collectionDefs) {
    const doc = await strapi.documents('api::collection.collection').create({
      data: c,
      status: 'published',
    });
    colByHandle[c.handle] = doc.documentId;
  }

  const names = [
    'Aurora Hoodie', 'Nimbus Rain Jacket', 'Terra Sneakers', 'Solstice Tee', 'Vertex Backpack',
    'Halcyon Shorts', 'Onyx Beanie', 'Pulse Running Socks', 'Cobalt Windbreaker', 'Ember Flannel',
    'Cirrus Cap', 'Slate Joggers', 'Marigold Dress', 'Basalt Boots', 'Fern Cardigan',
    'Quartz Polo', 'Dune Sandals', 'Ridge Parka', 'Willow Skirt', 'Ion Tank',
    'Cedar Sweater', 'Flint Gloves', 'Meadow Scarf', 'Harbor Chinos', 'Peak Vest',
    'Lumen Leggings', 'Drift Swim Shorts', 'Grove Henley', 'Talon Trail Shoes', 'Aster Blouse',
  ];
  const materials = ['Organic cotton', 'Recycled nylon', 'Suede', 'Merino wool', 'Linen blend', 'Ripstop', 'Cotton', 'Coolmax'];
  const handles = collectionDefs.map((c) => c.handle);

  const DRAFT_COUNT = 2; // last 2 are unpublished — exercise the published-only path

  for (let i = 0; i < names.length; i++) {
    const title = names[i];
    const price = Math.round((12 + ((i * 7) % 180)) * 100) / 100 + 0.99;

    const cols = new Set<string>([handles[i % handles.length]]);
    if (i % 2 === 0) cols.add(handles[(i + 2) % handles.length]);
    if (i % 3 === 0) cols.add(handles[(i + 4) % handles.length]);

    const recs = new Set<string>([handles[(i + 1) % handles.length]]);
    if (i % 2 === 1) recs.add(handles[(i + 3) % handles.length]);

    const isDraft = i >= names.length - DRAFT_COUNT;

    await strapi.documents('api::product.product').create({
      data: {
        title: isDraft ? `${title} (Draft)` : title,
        handle: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        price,
        description: `${title} — a quality product.`,
        collections: { connect: [...cols].map((h) => colByHandle[h]) },
        details: {
          sku: `SKU-${title.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)}`,
          material: materials[i % materials.length],
          spec: {
            warranty: '1 year',
            weightGrams: 60 + ((i * 37) % 900),
          },
        },
        recommended: [...recs].map((h, idx) => ({
          label: `Because you liked this #${idx + 1}`,
          collection: colByHandle[h],
        })),
      },
      status: isDraft ? 'draft' : 'published',
    });
  }

  strapi.log.info(
    `[seed] done: ${collectionDefs.length} collections, ${names.length} products (${names.length - DRAFT_COUNT} published + ${DRAFT_COUNT} draft).`
  );
}

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await createAdminUser(strapi);
    await openPublicReadAccess(strapi);
    await seed(strapi);
  },
};
