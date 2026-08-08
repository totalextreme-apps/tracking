const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://dbhjqpfoqrdrtibqglra.supabase.co';
const supabaseAnonKey = 'sb_publishable_1HsqHfQV_ewZf4MdYQCTEQ_4VRvWGZV';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const email = `test_reactor_${Date.now()}@mediatracking.app`;
  const password = 'password123';

  console.log('Signing up a test user:', email);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpError) {
    console.error('Sign up error:', signUpError);
    return;
  }

  const userId = signUpData.user.id;
  console.log('Successfully signed up user ID:', userId);

  // Wait a moment for trigger to create the profile
  console.log('Waiting for profile trigger to finish...');
  await new Promise(r => setTimeout(r, 2000));

  // Check if profile exists
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  console.log('Profile created in database:', profile);

  if (!profile) {
    console.error('Trigger did not create profile! The FK check on reactions will fail.');
    return;
  }

  // Get a valid collection item
  const { data: items } = await supabase.from('collection_items').select('id').limit(1);
  if (!items || items.length === 0) {
    console.error('No collection items found to react to.');
    return;
  }
  const itemId = items[0].id;
  console.log('Testing insert on reactions for user:', userId, 'on item:', itemId);

  // Try inserting using the newly authenticated user's session
  // Since supabase client preserves the session, we can do it directly:
  const { data: reactData, error: reactError } = await supabase.from('reactions').insert({
    user_id: userId,
    collection_item_id: itemId,
    reaction_type: '👍'
  }).select();

  if (reactError) {
    console.error('Error inserting reaction:', reactError);
  } else {
    console.log('Successfully inserted reaction:', reactData);
    
    // Clean up
    await supabase.from('reactions').delete().eq('id', reactData[0].id);
    console.log('Cleaned up test reaction.');
  }

  // Clean up user? We don't have admin key to delete user, but it's fine for testing.
}

run();
