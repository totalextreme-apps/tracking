const { fetchEbaySoldValue } = require('../lib/pricing');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Mock window dimensions and Platform for Node test
global.Platform = { OS: 'web' }; // Test web path first

async function test() {
  console.log('Testing fetchEbaySoldValue (Web Mode)...');
  try {
    const res = await fetchEbaySoldValue('Pulp Fiction', 'VHS');
    console.log('Result (Web Mode):', res);
  } catch (err) {
    console.error('Error in Web Mode:', err);
  }

  // Test native path (simulate direct mobile fetch from Node environment)
  console.log('\nTesting fetchEbaySoldValue (Native Mode)...');
  global.Platform = { OS: 'ios' };
  try {
    const res = await fetchEbaySoldValue('Pulp Fiction', 'VHS');
    console.log('Result (Native Mode):', res);
  } catch (err) {
    console.error('Error in Native Mode:', err);
  }
}

test();
