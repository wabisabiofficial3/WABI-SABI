const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && (serviceRoleKey || anonKey)) {
    supabase = createClient(supabaseUrl, serviceRoleKey || anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
    if (!serviceRoleKey) {
        console.warn('⚠️ Supabase is using the anon key; server writes may be denied by Row Level Security.');
    }
} else {
    console.warn('⚠️ Supabase is not configured; optional Supabase integrations are disabled.');
}

module.exports = { supabase };
