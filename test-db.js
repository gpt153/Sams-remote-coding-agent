// Quick test to verify Supabase connection works locally
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});

async function test() {
  try {
    console.log('Testing connection to:', process.env.DATABASE_URL?.split('@')[1]);
    const result = await pool.query('SELECT 1 as test');
    console.log('✅ Connection successful!', result.rows);
    await pool.end();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

test();
