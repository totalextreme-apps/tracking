const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://dbhjqpfoqrdrtibqglra.supabase.co';
const supabaseAnonKey = 'sb_publishable_1HsqHfQV_ewZf4MdYQCTEQ_4VRvWGZV';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkMovies() {
    const { data: movies, error } = await supabase
        .from('movies')
        .select('*')
        .ilike('title', '%escape%');

    if (error) console.error(error);
    else {
        console.log('Movies matching escape:', movies);
        for (const m of movies) {
            const { data: items } = await supabase
                .from('collection_items')
                .select('*')
                .eq('movie_id', m.id);
            console.log(`Collection items for movie ${m.id} (${m.title}):`, items);
        }
    }
}

checkMovies();
