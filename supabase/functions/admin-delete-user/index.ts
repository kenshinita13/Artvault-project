import { createClient } from 'npm:@supabase/supabase-js@2.106.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return jsonResponse({ error: 'Authentication required.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Server configuration is incomplete.' }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Invalid session.' }, 401);
  }

  const { data: callerProfile, error: callerError } = await adminClient
    .from('profiles')
    .select('role, status')
    .eq('id', userData.user.id)
    .single();
  if (callerError || callerProfile?.role !== 'admin' || callerProfile.status !== 'active') {
    return jsonResponse({ error: 'Administrator access required.' }, 403);
  }

  let payload: { userId?: string };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'A valid JSON body is required.' }, 400);
  }

  const targetUserId = payload.userId?.trim();
  if (!targetUserId) {
    return jsonResponse({ error: 'userId is required.' }, 400);
  }
  if (targetUserId === userData.user.id) {
    return jsonResponse({ error: 'Administrators cannot delete their own account.' }, 400);
  }

  const { data: targetProfile, error: targetError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', targetUserId)
    .single();
  if (targetError) {
    return jsonResponse({ error: 'Target account was not found.' }, 404);
  }
  if (targetProfile.role === 'admin') {
    return jsonResponse({ error: 'Administrator accounts are protected from deletion.' }, 403);
  }

  const storedPaths: string[] = [];
  let offset = 0;
  const pageSize = 100;
  while (true) {
    const { data: files, error: listError } = await adminClient.storage
      .from('artworks')
      .list(targetUserId, { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } });
    if (listError) {
      return jsonResponse({ error: `Could not inspect account files: ${listError.message}` }, 500);
    }
    for (const file of files || []) {
      if (file.name) storedPaths.push(`${targetUserId}/${file.name}`);
    }
    if (!files || files.length < pageSize) break;
    offset += pageSize;
  }

  for (let index = 0; index < storedPaths.length; index += 100) {
    const { error: removeError } = await adminClient.storage
      .from('artworks')
      .remove(storedPaths.slice(index, index + 100));
    if (removeError) {
      return jsonResponse({ error: `Could not remove account files: ${removeError.message}` }, 500);
    }
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId, false);
  if (deleteError) {
    return jsonResponse({ error: `Could not delete account: ${deleteError.message}` }, 500);
  }

  return jsonResponse({ deleted: true, removedFiles: storedPaths.length });
});
