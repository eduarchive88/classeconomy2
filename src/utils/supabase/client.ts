
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Supabase environment variables are missing');
        // Return dummy or empty client to prevent build crash
        // This will fail at runtime if not fixed
    }

    return createBrowserClient(supabaseUrl || '', supabaseKey || '', {
        db: {
            schema: 'economy'
        }
    })
}
