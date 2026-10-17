const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkColumns() {
  try {
    const res = await pool.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('orders', 'order_items', 'products', 'stock_adjustments')
      ORDER BY table_name, ordinal_position;
    `);
    const grouped = {};
    for (const r of res.rows) {
      if (!grouped[r.table_name]) grouped[r.table_name] = [];
      grouped[r.table_name].push(`${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`);
    }
    console.log(JSON.stringify(grouped, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

checkColumns();
