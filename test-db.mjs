import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: dbData, error: dbError } = await supabase.from('market_data').select('*').limit(1);
    console.log('market_data:', dbData, dbError);

    const { data: tsData, error: tsError } = await supabase.from('teacher_settings').select('*').limit(1);
    console.log('teacher_settings:', tsData, tsError);
}
check();
