const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

function parseBearerToken(request) {
  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

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

async function countRecentActiveUsers(env, days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/boxer_profiles`);
  url.searchParams.set('select', 'user_id');
  url.searchParams.set('last_seen_at', `gte.${since}`);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Recent active users failed: ${res.status} ${body}`);
  }

  const contentRange = res.headers.get('content-range') || '';
  const match = contentRange.match(/\/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

async function fetchUserRows(env, table, userId, limit = 30) {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', 'id,payload,created_at,updated_at');
  url.searchParams.set('user_id', `eq.${userId}`);
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url.toString(), {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${table} fetch failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchUserProfile(env, userId) {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/boxer_profiles`);
  url.searchParams.set('select', 'settings,last_seen_at,updated_at');
  url.searchParams.set('user_id', `eq.${userId}`);
  url.searchParams.set('limit', '1');
  const res = await fetch(url.toString(), {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`boxer_profiles fetch failed: ${res.status} ${body}`);
  }
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function startsWithDate(value, day) {
  return typeof value === 'string' && value.slice(0, 10) === day;
}

function summarizeUserData(profile, weights, meals, trainings, goals, hydration, recovery) {
  const today = new Date().toISOString().slice(0, 10);
  const settings = profile?.settings && typeof profile.settings === 'object' ? profile.settings : {};
  const latestWeight = weights[0]?.payload || null;
  const todayMeals = meals.filter((row) => startsWithDate(row?.payload?.date, today));
  const todayCalories = Math.round(todayMeals.reduce((sum, row) => sum + safeNumber(row?.payload?.calories), 0));
  const todayProtein = Math.round(todayMeals.reduce((sum, row) => sum + safeNumber(row?.payload?.protein), 0));
  const todayTrainings = trainings.filter((row) => startsWithDate(row?.payload?.date, today));
  const todayTrainingMinutes = Math.round(todayTrainings.reduce((sum, row) => sum + safeNumber(row?.payload?.duration), 0));
  const todayTrainingBurned = Math.round(todayTrainings.reduce((sum, row) => sum + safeNumber(row?.payload?.calories_burned), 0));
  const activeFight = goals
    .map((row) => row?.payload || {})
    .filter((goal) => goal?.status === '準備中' && goal?.fight_date)
    .sort((a, b) => String(a.fight_date).localeCompare(String(b.fight_date)))[0] || null;

  return {
    generated_at: new Date().toISOString(),
    today,
    athlete: {
      name: settings.athleteName || '',
      role: settings.athleteRole || '',
      target_weight: settings.targetWeight || '',
      daily_calorie_goal: settings.dailyCalorieGoal || '',
    },
    latest_weight: latestWeight ? {
      date: latestWeight.date || '',
      slot: latestWeight.slot || '',
      weight: latestWeight.weight || '',
      body_fat: latestWeight.body_fat || '',
      target_weight: latestWeight.target_weight || '',
      note: latestWeight.note || '',
    } : null,
    today_intake: {
      calories: todayCalories,
      protein: todayProtein,
      meal_count: todayMeals.length,
    },
    today_training: {
      minutes: todayTrainingMinutes,
      burned_calories: todayTrainingBurned,
      session_count: todayTrainings.length,
    },
    active_fight: activeFight ? {
      fight_date: activeFight.fight_date || '',
      opponent: activeFight.opponent || activeFight.opponent_name || '',
      target_weight: activeFight.target_weight || '',
    } : null,
    latest_hydration: hydration[0]?.payload || null,
    latest_recovery: recovery[0]?.payload || null,
    recent_meals: meals.slice(0, 5).map((row) => ({
      date: row?.payload?.date || '',
      meal_type: row?.payload?.meal_type || '',
      food_name: row?.payload?.food_name || '',
      calories: row?.payload?.calories || '',
      protein: row?.payload?.protein || '',
    })),
    recent_training: trainings.slice(0, 5).map((row) => ({
      date: row?.payload?.date || '',
      training_type: row?.payload?.training_type || '',
      duration: row?.payload?.duration || '',
      calories_burned: row?.payload?.calories_burned || '',
    })),
  };
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const outputs = Array.isArray(payload?.output) ? payload.output : [];
  const chunks = [];
  outputs.forEach((item) => {
    const content = Array.isArray(item?.content) ? item.content : [];
    content.forEach((part) => {
      if (part?.type === 'output_text' && typeof part?.text === 'string') {
        chunks.push(part.text);
      }
    });
  });
  return chunks.join('\n').trim();
}

async function handleAiChat(request, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server auth env is not configured' }, 500);
  }
  if (!env.OPENAI_API_KEY) {
    return json({ error: 'OPENAI_API_KEY is not configured' }, 500);
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const accessToken = parseBearerToken(request);
  if (!accessToken) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const sessionUser = await getSessionUser(env, accessToken);
  const userId = String(sessionUser?.id || '').trim();
  if (!userId) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const question = String(body?.question || '').trim();
  if (!question) return json({ error: 'question is required' }, 400);
  if (question.length > 1000) return json({ error: 'question is too long' }, 400);

  const [profile, weights, meals, trainings, goals, hydration, recovery] = await Promise.all([
    fetchUserProfile(env, userId),
    fetchUserRows(env, 'boxer_weight_logs', userId, 30),
    fetchUserRows(env, 'boxer_meals', userId, 50),
    fetchUserRows(env, 'boxer_training_logs', userId, 30),
    fetchUserRows(env, 'boxer_fight_goals', userId, 10),
    fetchUserRows(env, 'boxer_hydration_logs', userId, 10),
    fetchUserRows(env, 'boxer_recovery_logs', userId, 10),
  ]);
  const summary = summarizeUserData(profile, weights, meals, trainings, goals, hydration, recovery);

  const model = env.OPENAI_MODEL || 'gpt-4.1-mini';
  const systemText = [
    'You are a boxing performance coach assistant.',
    'Use only the provided user data summary.',
    'If data is missing, explicitly say what is missing.',
    'Keep answer concise in Japanese with practical actions for today and tomorrow.',
    'Do not provide medical diagnosis.',
  ].join(' ');
  const userText = `ユーザー質問:\n${question}\n\nユーザーデータ要約(JSON):\n${JSON.stringify(summary)}`;

  const aiRes = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_output_tokens: 500,
      input: [
        { role: 'system', content: [{ type: 'text', text: systemText }] },
        { role: 'user', content: [{ type: 'text', text: userText }] },
      ],
    }),
  });
  if (!aiRes.ok) {
    const errText = await aiRes.text();
    throw new Error(`OpenAI responses failed: ${aiRes.status} ${errText}`);
  }
  const aiPayload = await aiRes.json();
  const answer = extractResponseText(aiPayload);
  if (!answer) {
    return json({ error: 'AI response is empty' }, 502);
  }

  return json({
    answer,
    model,
    generated_at: new Date().toISOString(),
  });
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
  const activeUsers7d = await countRecentActiveUsers(env, 7);
  return json({
    total_users: totalUsers,
    active_users_7d: activeUsers7d,
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

    if (url.pathname === '/api/ai/chat') {
      try {
        return await handleAiChat(request, env);
      } catch (error) {
        console.error('BOXER PRO worker ai chat error', error);
        return json({ error: 'Internal server error' }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
