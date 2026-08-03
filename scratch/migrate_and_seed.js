import 'dotenv/config';
import fs from 'fs';
import { query } from './backend/src/db/index.js';

async function run() {
  const sql = fs.readFileSync('./backend/src/db/schema.sql', 'utf8');
  await query(sql);
  
  const defaultBrandConfig = {
    contactNumber: "+91 98765 43210",
    address: "123 Campus Road, Near Engineering Block,\nPune, Maharashtra 411001",
    openingHours: "Mon-Sun: 8:00 AM - 11:30 PM",
    facebookUrl: "https://facebook.com",
    instagramUrl: "https://instagram.com"
  };

  await query(
    `INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
    ['brand_config', JSON.stringify(defaultBrandConfig)]
  );
  
  console.log("Migration and seeding complete.");
  process.exit(0);
}
run();
