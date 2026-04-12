const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

function getAdminEmailSet(raw) {
  return new Set(
    String(raw || '')
      .split(/[\n,]/)
      .map((row) => row.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function getSessionUser(env, accessToken) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

async function countAuthUsers(env) {
  const perPage = 1000;
  let page = 1;
  let total = 0;

  while (true) {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Auth admin users failed: ${res.status} ${body}`);
    }

    const data = await res.json();
    const users = Array.isArray(data?.users) ? data.users : [];
    total += users.length;
    if (users.length < perPage) break;
    page += 1;
  }

  return total;
}

async function handleAdminStats(request, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server auth env is not configured' }, 500);
  }

  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const accessToken = match[1];
  const sessionUser = await getSessionUser(env, accessToken);
  const email = String(sessionUser?.email || '').trim().toLowerCase();
  if (!email) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const adminEmails = getAdminEmailSet(env.ADMIN_EMAILS);
  if (!adminEmails.has(email)) {
    return json({ error: 'Forbidden' }, 403);
  }

  const totalUsers = await countAuthUsers(env);
  return json({
    total_users: totalUsers,
    admin_email: email,
    measured_at: new Date().toISOString(),
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (url.pathname === '/api/admin/stats') {
      try {
        return await handleAdminStats(request, env);
      } catch (error) {
        console.error('BOXER PRO worker admin stats error', error);
        return json({ error: 'Internal server error' }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
