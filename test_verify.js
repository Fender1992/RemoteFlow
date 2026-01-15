const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function verify() {
    console.log('Marking Mortenson as verified...')
    const { data, error } = await supabase
        .from('companies')
        .update({ is_verified: true })
        .eq('name', 'Mortenson')

    if (error) console.error('Error:', error.message)
    else console.log('Mortenson is now verified!')
}

verify()
