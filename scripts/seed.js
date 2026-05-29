const { Pool } = require("../user-service/node_modules/pg");

const pool = new Pool({
  user: "dana",
  password: "dana2002",
  host: "localhost",
  database: "taskero_db",
  port: 5432,
});

// This tasker already exists in the DB — we only insert extra gigs for them, never delete their data.
const EXISTING_TASKER_ID = "a0d07783-b31b-4a1a-94f3-6be5545de14f";

const LOCATIONS = [
  { lat: 6.89, lng: 79.85, city: "Colombo 3" },
  { lat: 6.905, lng: 79.863, city: "Colombo 7" },
  { lat: 6.8735, lng: 79.8887, city: "Nugegoda" },
  { lat: 6.8519, lng: 79.8653, city: "Dehiwala" },
  { lat: 6.8471, lng: 79.9262, city: "Maharagama" },
  { lat: 6.8311, lng: 79.9672, city: "Kottawa" },
];

// Stable Unsplash image URLs per category (3 images each)
const CATEGORY_IMAGES = {
  Cleaning: [
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80",
    "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=800&q=80",
    "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=800&q=80",
  ],
  Plumbing: [
    "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=800&q=80",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80",
  ],
  Laundry: [
    "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=800&q=80",
    "https://images.unsplash.com/photo-1517677129300-07b130802f46?w=800&q=80",
    "https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?w=800&q=80",
  ],
  Painting: [
    "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&q=80",
    "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=800&q=80",
    "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80",
  ],
  Repairing: [
    "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80",
    "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&q=80",
    "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800&q=80",
  ],
  Electrician: [
    "https://images.unsplash.com/photo-1555963966-b7ae5404b6ed?w=800&q=80",
    "https://images.unsplash.com/photo-1509390144018-eeeb09e7ebe0?w=800&q=80",
    "https://images.unsplash.com/photo-1558402529-d2638a7023e9?w=800&q=80",
  ],
  Assembly: [
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80",
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80",
    "https://images.unsplash.com/photo-1519710164239-da123dc3b847?w=800&q=80",
  ],
  Carpentry: [
    "https://images.unsplash.com/photo-1601055903647-ddf1ee9701b7?w=800&q=80",
    "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80",
    "https://images.unsplash.com/photo-1565372195458-9de0b320ef04?w=800&q=80",
  ],
  Moving: [
    "https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=800&q=80",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    "https://images.unsplash.com/photo-1464983953574-0892a716854b?w=800&q=80",
  ],
  Gardening: [
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80",
    "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&q=80",
    "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=800&q=80",
  ],
  General: [
    "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=800&q=80",
    "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80",
    "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&q=80",
  ],
};

const CATEGORIES = [
  "Cleaning",
  "Plumbing",
  "Laundry",
  "Painting",
  "Repairing",
  "Electrician",
  "Assembly",
  "Carpentry",
  "Moving",
  "Gardening",
  "General",
];

const GIG_DATA = {
  Cleaning: [
    {
      title: "Home Deep Cleaning",
      desc: "Thorough deep clean of your entire home including kitchen, bathrooms, and all rooms.",
      price: 3500,
      tags: ["deep clean", "home", "residential"],
    },
    {
      title: "Office Cleaning",
      desc: "Professional office cleaning service — desks, floors, restrooms, and common areas.",
      price: 5000,
      tags: ["office", "commercial", "weekly"],
    },
    {
      title: "Post-Construction Cleanup",
      desc: "Remove construction dust and debris for a move-in ready space.",
      price: 8000,
      tags: ["construction", "dust", "heavy duty"],
    },
  ],
  Plumbing: [
    {
      title: "Pipe Repair & Leak Fix",
      desc: "Fast and reliable pipe repair and leak fixing for all types of plumbing systems.",
      price: 2500,
      tags: ["leak", "pipe", "repair"],
    },
    {
      title: "Bathroom Fixture Installation",
      desc: "Installation of taps, showers, toilet cisterns, and other bathroom fixtures.",
      price: 4000,
      tags: ["installation", "bathroom", "fixture"],
    },
    {
      title: "Drain Unblocking",
      desc: "Professional drain clearing and unblocking service for kitchen and bathroom drains.",
      price: 1800,
      tags: ["drain", "blocked", "clearing"],
    },
  ],
  Laundry: [
    {
      title: "Wash & Fold Service",
      desc: "Full wash, dry, and fold service for your clothes — collected and returned same day.",
      price: 1200,
      tags: ["wash", "fold", "same day"],
    },
    {
      title: "Dry Cleaning & Ironing",
      desc: "Professional dry cleaning and ironing for suits, dresses, and delicate fabrics.",
      price: 2000,
      tags: ["dry clean", "ironing", "formal"],
    },
    {
      title: "Bulk Laundry",
      desc: "Handle large volumes of laundry — perfect for families, guesthouses, and salons.",
      price: 3000,
      tags: ["bulk", "family", "commercial"],
    },
  ],
  Painting: [
    {
      title: "Interior Wall Painting",
      desc: "High quality interior painting with premium paints and smooth finish.",
      price: 6000,
      tags: ["interior", "wall", "painting"],
    },
    {
      title: "Exterior House Painting",
      desc: "Weather-resistant exterior painting to protect and beautify your home.",
      price: 12000,
      tags: ["exterior", "house", "weather-resistant"],
    },
    {
      title: "Furniture Refinishing",
      desc: "Restore and repaint wooden furniture to look brand new.",
      price: 3500,
      tags: ["furniture", "wood", "refinishing"],
    },
  ],
  Repairing: [
    {
      title: "Home Appliance Repair",
      desc: "Diagnose and repair washing machines, refrigerators, ovens, and other appliances.",
      price: 2000,
      tags: ["appliance", "repair", "home"],
    },
    {
      title: "Door & Window Repair",
      desc: "Fix squeaky hinges, broken handles, warped frames, and damaged glass.",
      price: 1500,
      tags: ["door", "window", "fix"],
    },
    {
      title: "General Maintenance",
      desc: "Comprehensive home maintenance covering minor repairs, patching, and upkeep.",
      price: 2500,
      tags: ["maintenance", "general", "handyman"],
    },
  ],
  Electrician: [
    {
      title: "Wiring & Rewiring",
      desc: "Safe and certified electrical wiring and rewiring for homes and offices.",
      price: 5000,
      tags: ["wiring", "electrical", "certified"],
    },
    {
      title: "Fan & Light Installation",
      desc: "Install ceiling fans, light fixtures, LED downlights, and outdoor lights.",
      price: 1500,
      tags: ["fan", "light", "installation"],
    },
    {
      title: "Electrical Panel Service",
      desc: "Inspection, repair, and upgrade of circuit breakers and distribution boards.",
      price: 7000,
      tags: ["panel", "breaker", "board"],
    },
  ],
  Assembly: [
    {
      title: "Flat-Pack Furniture Assembly",
      desc: "Expert assembly of IKEA and other flat-pack furniture — fast and accurate.",
      price: 1800,
      tags: ["ikea", "flat-pack", "furniture"],
    },
    {
      title: "Gym Equipment Assembly",
      desc: "Safe assembly of treadmills, exercise bikes, and gym racks.",
      price: 3000,
      tags: ["gym", "treadmill", "equipment"],
    },
    {
      title: "Office Furniture Setup",
      desc: "Assemble and arrange desks, shelving units, and office chairs.",
      price: 2500,
      tags: ["office", "desk", "setup"],
    },
  ],
  Carpentry: [
    {
      title: "Custom Cabinet Making",
      desc: "Bespoke kitchen and bedroom cabinets crafted to your exact specifications.",
      price: 15000,
      tags: ["cabinet", "custom", "kitchen"],
    },
    {
      title: "Door Frame Repair",
      desc: "Repair damaged or rotted door frames and replace damaged doors.",
      price: 3500,
      tags: ["door", "frame", "repair"],
    },
    {
      title: "Wood Flooring Installation",
      desc: "Install laminate, hardwood, or engineered wood flooring with precision.",
      price: 10000,
      tags: ["flooring", "wood", "laminate"],
    },
  ],
  Moving: [
    {
      title: "Local House Moving",
      desc: "Full home moving service including packing, transport, and unpacking.",
      price: 12000,
      tags: ["moving", "house", "packing"],
    },
    {
      title: "Office Relocation",
      desc: "Efficient office move with minimal downtime — furniture and equipment handled safely.",
      price: 20000,
      tags: ["office", "relocation", "commercial"],
    },
    {
      title: "Single Item Delivery",
      desc: "Delivery of heavy or large single items like sofas, fridges, or wardrobes.",
      price: 3000,
      tags: ["delivery", "single item", "heavy"],
    },
  ],
  Gardening: [
    {
      title: "Garden Maintenance",
      desc: "Regular garden upkeep including weeding, planting, and general tidying.",
      price: 2500,
      tags: ["garden", "maintenance", "regular"],
    },
    {
      title: "Lawn Mowing & Edging",
      desc: "Professional lawn mowing and edge trimming for a neat finish.",
      price: 1500,
      tags: ["lawn", "mowing", "edging"],
    },
    {
      title: "Tree Trimming",
      desc: "Safe trimming and shaping of trees and large shrubs.",
      price: 4000,
      tags: ["tree", "trimming", "pruning"],
    },
  ],
  General: [
    {
      title: "Handyman Services",
      desc: "Versatile handyman for a wide range of small jobs around the home or office.",
      price: 1800,
      tags: ["handyman", "general", "odd jobs"],
    },
    {
      title: "General Labour",
      desc: "Reliable general labour for loading, unloading, digging, and manual tasks.",
      price: 1200,
      tags: ["labour", "manual", "loading"],
    },
    {
      title: "Odd Jobs & Errands",
      desc: "Help with miscellaneous tasks that don't fit a single category.",
      price: 1000,
      tags: ["errands", "misc", "flexible"],
    },
  ],
};

const WORKERS = [
  // 2 per category = 22 workers
  { fn: "Kasun", ln: "Perera", phone: "+94711000001", email: "kasun.p@seed.test", loc: 0, radius: 8, jobs: 45, rate: 0.96, cats: ["Cleaning"] },
  { fn: "Nimali", ln: "Silva", phone: "+94711000002", email: "nimali.s@seed.test", loc: 1, radius: 12, jobs: 62, rate: 0.98, cats: ["Cleaning"] },
  { fn: "Thilina", ln: "Fernando", phone: "+94711000003", email: "thilina.f@seed.test", loc: 2, radius: 10, jobs: 38, rate: 0.92, cats: ["Plumbing"] },
  { fn: "Roshan", ln: "Jayawardena", phone: "+94711000004", email: "roshan.j@seed.test", loc: 3, radius: 15, jobs: 71, rate: 0.97, cats: ["Plumbing"] },
  { fn: "Sanduni", ln: "Weerasinghe", phone: "+94711000005", email: "sanduni.w@seed.test", loc: 4, radius: 7, jobs: 29, rate: 0.90, cats: ["Laundry"] },
  { fn: "Dilshan", ln: "Rajapaksha", phone: "+94711000006", email: "dilshan.r@seed.test", loc: 5, radius: 10, jobs: 55, rate: 0.95, cats: ["Laundry"] },
  { fn: "Pradeep", ln: "Bandara", phone: "+94711000007", email: "pradeep.b@seed.test", loc: 0, radius: 12, jobs: 33, rate: 0.88, cats: ["Painting"] },
  { fn: "Hasitha", ln: "Gunawardena", phone: "+94711000008", email: "hasitha.g@seed.test", loc: 1, radius: 8, jobs: 48, rate: 0.94, cats: ["Painting"] },
  { fn: "Chaminda", ln: "Dissanayake", phone: "+94711000009", email: "chaminda.d@seed.test", loc: 2, radius: 10, jobs: 22, rate: 0.86, cats: ["Repairing"] },
  { fn: "Kavinda", ln: "Wickramasinghe", phone: "+94711000010", email: "kavinda.w@seed.test", loc: 3, radius: 14, jobs: 67, rate: 0.99, cats: ["Repairing"] },
  { fn: "Nuwan", ln: "Samarasinghe", phone: "+94711000011", email: "nuwan.s@seed.test", loc: 4, radius: 10, jobs: 53, rate: 0.96, cats: ["Electrician"] },
  { fn: "Chathura", ln: "Liyanage", phone: "+94711000012", email: "chathura.l@seed.test", loc: 5, radius: 12, jobs: 41, rate: 0.93, cats: ["Electrician"] },
  { fn: "Asanka", ln: "Rathnayake", phone: "+94711000013", email: "asanka.r@seed.test", loc: 0, radius: 8, jobs: 18, rate: 0.89, cats: ["Assembly"] },
  { fn: "Madushan", ln: "Pathirana", phone: "+94711000014", email: "madushan.p@seed.test", loc: 1, radius: 10, jobs: 35, rate: 0.91, cats: ["Assembly"] },
  { fn: "Buddhika", ln: "Seneviratne", phone: "+94711000015", email: "buddhika.s@seed.test", loc: 2, radius: 15, jobs: 79, rate: 0.98, cats: ["Carpentry"] },
  { fn: "Isuru", ln: "Karunaratne", phone: "+94711000016", email: "isuru.k@seed.test", loc: 3, radius: 10, jobs: 44, rate: 0.94, cats: ["Carpentry"] },
  { fn: "Chanaka", ln: "Madushanka", phone: "+94711000017", email: "chanaka.m@seed.test", loc: 4, radius: 12, jobs: 26, rate: 0.87, cats: ["Moving"] },
  { fn: "Tharaka", ln: "Nallaperuma", phone: "+94711000018", email: "tharaka.n@seed.test", loc: 5, radius: 20, jobs: 58, rate: 0.95, cats: ["Moving"] },
  { fn: "Ruwan", ln: "Amarasinghe", phone: "+94711000019", email: "ruwan.a@seed.test", loc: 0, radius: 8, jobs: 31, rate: 0.90, cats: ["Gardening"] },
  { fn: "Lasith", ln: "Mendis", phone: "+94711000020", email: "lasith.m@seed.test", loc: 1, radius: 10, jobs: 47, rate: 0.93, cats: ["Gardening"] },
  { fn: "Sachith", ln: "Pushpakumara", phone: "+94711000021", email: "sachith.p@seed.test", loc: 2, radius: 10, jobs: 12, rate: 0.85, cats: ["General"] },
  { fn: "Dilan", ln: "Thilakasiri", phone: "+94711000022", email: "dilan.t@seed.test", loc: 3, radius: 12, jobs: 39, rate: 0.92, cats: ["General"] },
];

const CUSTOMERS = [
  { fn: "Anjali", ln: "Cooray", phone: "+94722000001", email: "anjali.c@seed.test", loc: 0 },
  { fn: "Sameera", ln: "Rodrigo", phone: "+94722000002", email: "sameera.r@seed.test", loc: 1 },
  { fn: "Hiruni", ln: "Pieris", phone: "+94722000003", email: "hiruni.p@seed.test", loc: 2 },
  { fn: "Malith", ln: "De Silva", phone: "+94722000004", email: "malith.d@seed.test", loc: 3 },
  { fn: "Yasoda", ln: "Kumari", phone: "+94722000005", email: "yasoda.k@seed.test", loc: 4 },
  { fn: "Tharindu", ln: "Senanayake", phone: "+94722000006", email: "tharindu.s@seed.test", loc: 5 },
];

async function clearSeedData(client) {
  console.log("Clearing seed data...");
  // Delete in FK-safe order, but only seed rows (identified by email ending in @seed.test)
  const seedUserIds = await client.query(
    `SELECT id FROM users WHERE email LIKE '%@seed.test'`
  );
  if (seedUserIds.rows.length === 0) {
    console.log("  No existing seed data found.");
    return;
  }
  const ids = seedUserIds.rows.map((r) => r.id);
  const idList = ids.map((_, i) => `$${i + 1}`).join(",");

  await client.query(`DELETE FROM reviews WHERE reviewer_id IN (${idList}) OR tasker_id IN (${idList})`, ids);
  await client.query(`DELETE FROM payments WHERE payer_id IN (${idList})`, ids);
  await client.query(`DELETE FROM tasks WHERE customer_id IN (${idList}) OR tasker_id IN (${idList})`, ids);
  await client.query(`DELETE FROM gigs WHERE tasker_id IN (${idList})`, ids);
  await client.query(`DELETE FROM worker_category_certifications WHERE user_id IN (${idList})`, ids);
  await client.query(`DELETE FROM users WHERE id IN (${idList})`, ids);
  console.log(`  Removed ${ids.length} seed users and their related data.`);
}

async function seedUsers(client) {
  console.log("Seeding users...");
  const workerIds = [];
  const customerIds = [];

  for (const w of WORKERS) {
    const loc = LOCATIONS[w.loc];
    const res = await client.query(
      `INSERT INTO users (email, first_name, last_name, phone_number, role,
         location_lat, location_lng, city, firebase_uid, completed_jobs, completion_rate,
         bio, avatar_url)
       VALUES ($1,$2,$3,$4,'tasker',$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        w.email, w.fn, w.ln, w.phone,
        loc.lat, loc.lng, loc.city,
        `seed_uid_worker_${w.phone.slice(-5)}`,
        w.jobs, w.rate,
        `Experienced ${w.cats[0].toLowerCase()} professional based in ${loc.city}.`,
        null,
      ]
    );
    workerIds.push({ id: res.rows[0].id, ...w });
  }

  for (const c of CUSTOMERS) {
    const loc = LOCATIONS[c.loc];
    const res = await client.query(
      `INSERT INTO users (email, first_name, last_name, phone_number, role,
         location_lat, location_lng, city, firebase_uid)
       VALUES ($1,$2,$3,$4,'customer',$5,$6,$7,$8)
       RETURNING id`,
      [
        c.email, c.fn, c.ln, c.phone,
        loc.lat, loc.lng, loc.city,
        `seed_uid_customer_${c.phone.slice(-5)}`,
      ]
    );
    customerIds.push({ id: res.rows[0].id, ...c });
  }

  console.log(`  Inserted ${workerIds.length} workers, ${customerIds.length} customers.`);
  return { workerIds, customerIds };
}

const DEFAULT_VISIT_TIERS = JSON.stringify([
  { label: "Standard", days: 7, surcharge_type: "percent", surcharge_value: 0 },
  { label: "Fast", days: 3, surcharge_type: "flat", surcharge_value: 1000 },
  { label: "Urgent", days: 1, surcharge_type: "percent", surcharge_value: 30 },
]);

async function seedGigs(client, workerIds) {
  console.log("Seeding gigs...");
  const gigIds = {}; // category -> [{id, taskerId}]
  let count = 0;

  for (const worker of workerIds) {
    const category = worker.cats[0];
    const gigs = GIG_DATA[category];
    const loc = LOCATIONS[worker.loc];

    for (let i = 0; i < gigs.length; i++) {
      const gig = gigs[i];
      const images = CATEGORY_IMAGES[category] || [];
      // Each gig gets 2-3 images; rotate through available images
      const gigImages = [images[i % images.length], images[(i + 1) % images.length]].filter(Boolean);
      const res = await client.query(
        `INSERT INTO gigs (tasker_id, title, description, category, base_price, tags,
           service_area_lat, service_area_lng, service_area_radius_km, is_active, attachments, visit_tiers)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$11)
         RETURNING id`,
        [
          worker.id, gig.title, gig.desc, category, gig.price,
          gig.tags, loc.lat, loc.lng, worker.radius,
          JSON.stringify(gigImages), DEFAULT_VISIT_TIERS,
        ]
      );
      if (!gigIds[category]) gigIds[category] = [];
      gigIds[category].push({ id: res.rows[0].id, taskerId: worker.id });
      count++;
    }
  }

  console.log(`  Inserted ${count} gigs.`);
  return gigIds;
}

async function seedExistingTaskerGigs(client) {
  console.log(`Seeding extra gigs for existing tasker ${EXISTING_TASKER_ID}...`);

  // Verify the tasker exists
  const check = await client.query(`SELECT id FROM users WHERE id = $1`, [EXISTING_TASKER_ID]);
  if (check.rows.length === 0) {
    console.log("  Tasker not found — skipping.");
    return;
  }

  const loc = LOCATIONS[0]; // Colombo 3
  let count = 0;

  for (const category of CATEGORIES) {
    const gigs = GIG_DATA[category];
    // Add all 3 gigs per category for the existing tasker
    for (let i = 0; i < gigs.length; i++) {
      const gig = gigs[i];
      const images = CATEGORY_IMAGES[category] || [];
      const gigImages = [images[i % images.length], images[(i + 1) % images.length]].filter(Boolean);
      await client.query(
        `INSERT INTO gigs (tasker_id, title, description, category, base_price, tags,
           service_area_lat, service_area_lng, service_area_radius_km, is_active, attachments, visit_tiers)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$11)`,
        [
          EXISTING_TASKER_ID, gig.title, gig.desc, category, gig.price,
          gig.tags, loc.lat, loc.lng, 15,
          JSON.stringify(gigImages), DEFAULT_VISIT_TIERS,
        ]
      );
      count++;
    }
  }

  console.log(`  Inserted ${count} extra gigs for existing tasker.`);
}

async function seedCertifications(client, workerIds) {
  console.log("Seeding certifications...");
  const certWorkers = workerIds.filter((w) =>
    ["Electrician", "Plumbing"].includes(w.cats[0])
  );
  for (const w of certWorkers) {
    await client.query(
      `INSERT INTO worker_category_certifications
         (user_id, category, document_url, status, reviewed_at)
       VALUES ($1,$2,$3,'approved',NOW())`,
      [
        w.id, w.cats[0],
        `https://seed.example/certs/${w.id}.pdf`,
      ]
    );
  }
  console.log(`  Inserted ${certWorkers.length} certifications.`);
}

async function seedTasks(client, workerIds, customerIds, gigIds) {
  console.log("Seeding tasks...");
  const taskRows = [];

  const TIME_PREFS = ["morning", "afternoon", "evening"];

  const taskDefs = [
    // pending
    { cat: "Cleaning", custIdx: 0, workerIdx: 0, status: "pending", price: 3500, tier: "Standard", tierDays: 7, surcharge: 0, timePref: "morning", details: { home_size: "Medium", bedrooms: "3", cleaning_type: "Deep clean" } },
    { cat: "Plumbing", custIdx: 1, workerIdx: 2, status: "pending", price: 2500, tier: "Fast", tierDays: 3, surcharge: 1000, timePref: "afternoon", details: { issue_type: "Leaking kitchen tap", urgency: "Standard" } },
    { cat: "Gardening", custIdx: 2, workerIdx: 18, status: "pending", price: 1500, tier: "Standard", tierDays: 7, surcharge: 0, timePref: "evening", details: {} },
    // accepted
    { cat: "Painting", custIdx: 3, workerIdx: 6, status: "accepted", price: 6000, tier: "Standard", tierDays: 7, surcharge: 0, timePref: "morning", details: { num_rooms: "2", paint_supplied_by: "Worker" } },
    { cat: "Moving", custIdx: 4, workerIdx: 16, status: "accepted", price: 12000, tier: "Urgent", tierDays: 1, surcharge: 3600, timePref: "morning", details: { property_size: "2 Beds", floor: "1", elevator_available: "No", packing_needed: "Yes" } },
    { cat: "Laundry", custIdx: 5, workerIdx: 4, status: "accepted", price: 1200, tier: "Standard", tierDays: 7, surcharge: 0, timePref: "afternoon", details: { num_loads: "3", service_type: "Wash & fold" } },
    // in_progress
    { cat: "Electrician", custIdx: 0, workerIdx: 10, status: "in_progress", price: 1500, tier: "Fast", tierDays: 3, surcharge: 1000, timePref: "morning", details: { issue_desc: "Install 3 ceiling fans", num_fixtures: "3" } },
    { cat: "Assembly", custIdx: 1, workerIdx: 12, status: "in_progress", price: 1800, tier: "Standard", tierDays: 7, surcharge: 0, timePref: "afternoon", details: {} },
    { cat: "Repairing", custIdx: 2, workerIdx: 8, status: "in_progress", price: 2000, tier: "Standard", tierDays: 7, surcharge: 0, timePref: "evening", details: {} },
    // completed
    { cat: "Cleaning", custIdx: 3, workerIdx: 1, status: "completed", price: 3500, tier: "Standard", tierDays: 7, surcharge: 0, timePref: "morning", details: { home_size: "Large", bedrooms: "4", cleaning_type: "Regular" } },
    { cat: "Carpentry", custIdx: 4, workerIdx: 14, status: "completed", price: 15000, tier: "Fast", tierDays: 3, surcharge: 1000, timePref: "afternoon", details: {} },
    { cat: "Plumbing", custIdx: 5, workerIdx: 3, status: "completed", price: 4000, tier: "Standard", tierDays: 7, surcharge: 0, timePref: "morning", details: { issue_type: "Install new shower", urgency: "Standard" } },
    { cat: "Painting", custIdx: 0, workerIdx: 7, status: "completed", price: 12000, tier: "Urgent", tierDays: 1, surcharge: 3600, timePref: "afternoon", details: { num_rooms: "4", paint_supplied_by: "Me" } },
    // cancelled
    { cat: "General", custIdx: 1, workerIdx: 21, status: "cancelled", price: 1000, tier: "Standard", tierDays: 7, surcharge: 0, timePref: "morning", details: {} },
    { cat: "Moving", custIdx: 2, workerIdx: 17, status: "cancelled", price: 3000, tier: "Standard", tierDays: 7, surcharge: 0, timePref: "evening", details: { property_size: "Studio", floor: "2", elevator_available: "Yes", packing_needed: "No" } },
  ];

  for (const t of taskDefs) {
    const worker = workerIds[t.workerIdx];
    const customer = customerIds[t.custIdx];
    const gig = gigIds[t.cat]?.[0];
    const loc = LOCATIONS[customer.loc];
    const promisedDate = new Date();
    promisedDate.setDate(promisedDate.getDate() + t.tierDays);
    const promisedDateStr = promisedDate.toISOString().split("T")[0];

    const res = await client.query(
      `INSERT INTO tasks (gig_id, customer_id, tasker_id, title, description, status,
         category, details, location_address, location_lat, location_lng,
         scheduled_at, completed_at, accepted_at,
         time_preference, selected_tier_label, selected_tier_days,
         surcharge_amount, promised_visit_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
         NOW() + interval '2 days',
         $12, $13, $14, $15, $16, $17, $18)
       RETURNING id`,
      [
        gig?.id ?? null,
        customer.id,
        worker.id,
        `${t.cat} Job`,
        `Seed task for ${t.cat} category.`,
        t.status,
        t.cat,
        JSON.stringify(t.details),
        `${loc.city}, Sri Lanka`,
        loc.lat, loc.lng,
        t.status === "completed" ? new Date() : null,
        ["accepted", "in_progress", "completed"].includes(t.status) ? new Date() : null,
        t.timePref,
        t.tier,
        t.tierDays,
        t.surcharge,
        promisedDateStr,
      ]
    );
    taskRows.push({ id: res.rows[0].id, ...t, customer, worker });
  }

  console.log(`  Inserted ${taskRows.length} tasks.`);
  return taskRows;
}

async function seedCategories(client) {
  console.log("Seeding service_categories...");

  const categories = [
    {
      name: "Cleaning", icon: "🧹", requires_certification: false, sort_order: 1,
      image_url: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80",
      booking_fields: [
        { key: "home_size", label: "Home size", placeholder: "e.g. 1200", type: "options-chips", options: ["Small", "Medium", "Large"] },
        { key: "bedrooms", label: "Bedrooms", placeholder: "e.g. 3", type: "number-chips" },
        { key: "bathrooms", label: "Bathrooms", placeholder: "e.g. 2", type: "number-chips" },
        { key: "cleaning_type", label: "Cleaning type", placeholder: "e.g. Deep clean", type: "options-chips", options: ["Regular", "Deep clean"] },
      ],
      cert_requirements: [], cert_description: "",
    },
    {
      name: "Plumbing", icon: "🔧", requires_certification: true, sort_order: 2,
      image_url: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=800&q=80",
      booking_fields: [
        { key: "issue_type", label: "Issue type", placeholder: "e.g. Leaking pipe", type: "text" },
        { key: "urgency", label: "Urgency", placeholder: "e.g. Urgent", type: "options-chips", options: ["Urgent", "Standard"] },
      ],
      cert_requirements: ["Licensed plumber certificate", "Issued by a recognized authority or trade body", "Must be valid and not expired"],
      cert_description: "Requires a licensed plumber certification or trade qualification.",
    },
    {
      name: "Laundry", icon: "👕", requires_certification: false, sort_order: 3,
      image_url: "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=800&q=80",
      booking_fields: [
        { key: "loads", label: "Number of loads", placeholder: "e.g. 3", type: "number-chips" },
        { key: "service_type", label: "Service type", placeholder: "e.g. Wash & fold", type: "options-chips", options: ["Wash & fold", "Dry clean", "Ironing"] },
      ],
      cert_requirements: [], cert_description: "",
    },
    {
      name: "Painting", icon: "🎨", requires_certification: false, sort_order: 4,
      image_url: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&q=80",
      booking_fields: [
        { key: "room_count", label: "Number of rooms", placeholder: "e.g. 2", type: "number-chips" },
        { key: "paint_supplied", label: "Paint supplied by", placeholder: "e.g. Me", type: "options-chips", options: ["Me", "Worker"] },
      ],
      cert_requirements: [], cert_description: "",
    },
    {
      name: "Repairing", icon: "🛠️", requires_certification: false, sort_order: 5,
      image_url: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80",
      booking_fields: [],
      cert_requirements: [], cert_description: "",
    },
    {
      name: "Electrician", icon: "⚡", requires_certification: true, sort_order: 6,
      image_url: "https://images.unsplash.com/photo-1555963966-b7ae5404b6ed?w=800&q=80",
      booking_fields: [
        { key: "issue", label: "Issue description", placeholder: "e.g. Outlet not working", type: "text" },
        { key: "fixture_count", label: "Number of fixtures", placeholder: "e.g. 4", type: "number-chips" },
      ],
      cert_requirements: ["Electrical trade license or certificate", "Issued by a recognized authority", "Must be valid and not expired"],
      cert_description: "Requires a valid electrical trade license or equivalent qualification.",
    },
    {
      name: "Assembly", icon: "🔩", requires_certification: false, sort_order: 7,
      image_url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80",
      booking_fields: [],
      cert_requirements: [], cert_description: "",
    },
    {
      name: "Carpentry", icon: "🪵", requires_certification: false, sort_order: 8,
      image_url: "https://images.unsplash.com/photo-1601055903647-ddf1ee9701b7?w=800&q=80",
      booking_fields: [],
      cert_requirements: [], cert_description: "",
    },
    {
      name: "Moving", icon: "📦", requires_certification: false, sort_order: 9,
      image_url: "https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=800&q=80",
      booking_fields: [
        { key: "property_size", label: "Property size", placeholder: "e.g. 2-bedroom", type: "options-chips", options: ["Studio", "1 Bedroom", "2 Bedrooms", "3+ Bedrooms"] },
        { key: "floor", label: "Floor (from)", placeholder: "e.g. 3", type: "number-chips" },
        { key: "has_elevator", label: "Elevator available", placeholder: "", type: "options-chips", options: ["Yes", "No"] },
        { key: "packing_needed", label: "Packing needed", placeholder: "", type: "options-chips", options: ["Yes", "No"] },
      ],
      cert_requirements: [], cert_description: "",
    },
    {
      name: "Gardening", icon: "🌱", requires_certification: false, sort_order: 10,
      image_url: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80",
      booking_fields: [],
      cert_requirements: [], cert_description: "",
    },
    {
      name: "General", icon: "✨", requires_certification: false, sort_order: 11,
      image_url: "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=800&q=80",
      booking_fields: [
        { key: "description", label: "Job description", placeholder: "Describe what you need done", type: "text" },
      ],
      cert_requirements: [], cert_description: "",
    },
  ];

  for (const cat of categories) {
    await client.query(
      `INSERT INTO service_categories
         (name, icon, requires_certification, image_url, booking_fields, cert_requirements, cert_description, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8)
       ON CONFLICT (name) DO UPDATE SET
         icon = EXCLUDED.icon,
         requires_certification = EXCLUDED.requires_certification,
         image_url = EXCLUDED.image_url,
         booking_fields = EXCLUDED.booking_fields,
         cert_requirements = EXCLUDED.cert_requirements,
         cert_description = EXCLUDED.cert_description,
         sort_order = EXCLUDED.sort_order,
         updated_at = NOW()`,
      [
        cat.name, cat.icon, cat.requires_certification, cat.image_url,
        JSON.stringify(cat.booking_fields),
        JSON.stringify(cat.cert_requirements),
        cat.cert_description, cat.sort_order,
      ]
    );
  }
  console.log(`  Upserted ${categories.length} service categories.`);
}

async function seedAppContent(client) {
  console.log("Seeding app_content...");

  const faqs = [
    { title: "How do I book a service?", body: { answer: "Browse or search for a service, tap on it, then follow the booking steps. You'll pick a location, date, and time." }, sort_order: 1 },
    { title: "How does pricing work?", body: { answer: "Prices start at the worker's base rate. After the job is assessed, the worker may send a formal quote. You can accept or decline." }, sort_order: 2 },
    { title: "Can I cancel a booking?", body: { answer: "Yes. Go to Bookings, select the booking, and use the cancel option. Cancellation policies depend on how close to the job time you cancel." }, sort_order: 3 },
    { title: "How do I pay?", body: { answer: "Payments are processed securely through the app. The amount is charged once you accept a worker's quote." }, sort_order: 4 },
    { title: "How do I become a worker?", body: { answer: "Sign up, choose 'Find Work' during account creation, set up your profile and services, and start receiving job requests." }, sort_order: 5 },
    { title: "What if I'm not satisfied?", body: { answer: "Contact the worker via chat first. If unresolved, use the Help Center to report the issue to our support team." }, sort_order: 6 },
  ];

  const promos = [
    { title: "Summer Special", body: { subtitle: "Get 20% off your first house cleaning booking", color: "#16A34A", icon: "sparkles" }, sort_order: 1 },
    { title: "Top Rated Experts", body: { subtitle: "Highly rated plumbers and electricians near you", color: "#1D4ED8", icon: "construct" }, sort_order: 2 },
    { title: "Quick Fixes", body: { subtitle: "Handyman services starting from just Rs. 49", color: "#EA580C", icon: "hammer" }, sort_order: 3 },
  ];

  const reviewTags = [
    { title: "Punctual", body: {}, sort_order: 1 },
    { title: "Clean work", body: {}, sort_order: 2 },
    { title: "Friendly", body: {}, sort_order: 3 },
    { title: "Professional", body: {}, sort_order: 4 },
    { title: "Good value", body: {}, sort_order: 5 },
    { title: "Communicated well", body: {}, sort_order: 6 },
  ];

  // Clear existing and re-insert for idempotency
  await client.query(`DELETE FROM app_content`);

  let count = 0;
  for (const item of faqs) {
    await client.query(
      `INSERT INTO app_content (content_type, title, body, sort_order, is_active) VALUES ('faq',$1,$2,$3,true)`,
      [item.title, JSON.stringify(item.body), item.sort_order]
    );
    count++;
  }
  for (const item of promos) {
    await client.query(
      `INSERT INTO app_content (content_type, title, body, sort_order, is_active) VALUES ('promo',$1,$2,$3,true)`,
      [item.title, JSON.stringify(item.body), item.sort_order]
    );
    count++;
  }
  for (const item of reviewTags) {
    await client.query(
      `INSERT INTO app_content (content_type, title, body, sort_order, is_active) VALUES ('review_tag',$1,$2,$3,true)`,
      [item.title, JSON.stringify(item.body), item.sort_order]
    );
    count++;
  }
  console.log(`  Inserted ${count} app_content rows.`);
}

async function seedPaymentsAndReviews(client, tasks, customerIds) {
  console.log("Seeding payments and reviews...");
  const completed = tasks.filter((t) => t.status === "completed");
  let pCount = 0;
  let rCount = 0;

  const reviewTexts = [
    "Excellent work, very professional and thorough!",
    "Great job done on time. Would recommend.",
    "Very satisfied with the service. Clean and tidy.",
    "Professional and friendly. Will book again.",
  ];

  for (const t of completed) {
    await client.query(
      `INSERT INTO payments (task_id, payer_id, amount, currency, payment_method, status, paid_at)
       VALUES ($1,$2,$3,'LKR','card','completed',NOW())`,
      [t.id, t.customer.id, t.price]
    );
    pCount++;

    await client.query(
      `INSERT INTO reviews (task_id, gig_id, reviewer_id, tasker_id, rating, review)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        t.id, null, t.customer.id, t.worker.id,
        Math.random() > 0.3 ? 5 : 4,
        reviewTexts[rCount % reviewTexts.length],
      ]
    );
    rCount++;
  }

  console.log(`  Inserted ${pCount} payments, ${rCount} reviews.`);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await seedCategories(client);
    await seedAppContent(client);
    await clearSeedData(client);
    const { workerIds, customerIds } = await seedUsers(client);
    const gigIds = await seedGigs(client, workerIds);
    await seedExistingTaskerGigs(client);
    await seedCertifications(client, workerIds);
    const tasks = await seedTasks(client, workerIds, customerIds, gigIds);
    await seedPaymentsAndReviews(client, tasks, customerIds);

    await client.query("COMMIT");
    console.log("\nSeed complete!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
