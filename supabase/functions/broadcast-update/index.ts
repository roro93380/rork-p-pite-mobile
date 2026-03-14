import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, authorization, x-client-info, apikey, content-type, x-admin-key',
}

type BroadcastPayload = {
  title: string
  body: string
  updateUrl: string
}

type AppUser = {
  id: string
  user_metadata?: Record<string, unknown>
}

async function sendExpoPush(messages: Array<Record<string, unknown>>) {
  if (messages.length === 0) {
    return { data: [] }
  }

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(messages),
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(`Expo Push API error: ${response.status} ${JSON.stringify(json)}`)
  }
  return json
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const adminKey = req.headers.get('x-admin-key') || ''
    const expectedAdminKey = Deno.env.get('UPDATE_PUSH_SECRET') || ''
    if (!expectedAdminKey || adminKey !== expectedAdminKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as BroadcastPayload
    if (!body?.title || !body?.body || !body?.updateUrl) {
      return new Response(JSON.stringify({ error: 'title, body and updateUrl are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const users: AppUser[] = []
    let page = 1
    const perPage = 100

    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
      if (error) throw error
      const batch = data.users as AppUser[]
      if (!batch || batch.length === 0) break
      users.push(...batch)
      if (batch.length < perPage) break
      page += 1
    }

    const notificationsRows = users.map((u) => ({
      user_id: u.id,
      type: 'update',
      title: body.title,
      message: body.body,
      link: body.updateUrl,
      read: false,
    }))

    if (notificationsRows.length > 0) {
      const { error: notifError } = await supabase.from('notifications').insert(notificationsRows)
      if (notifError) {
        console.warn('[broadcast-update] Could not insert notifications table rows:', notifError.message)
      }
    }

    const tokens = Array.from(new Set(
      users
        .map((u) => String((u.user_metadata || {}).expo_push_token || ''))
        .filter((token) => token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')),
    ))

    const messages = tokens.map((token) => ({
      to: token,
      title: body.title,
      body: body.body,
      sound: 'default',
      channelId: 'updates',
      categoryId: 'update_available',
      priority: 'high',
      data: {
        updateUrl: body.updateUrl,
        link: body.updateUrl,
        kind: 'app_update',
      },
    }))

    const expoResponse = await sendExpoPush(messages)

    return new Response(
      JSON.stringify({
        ok: true,
        usersCount: users.length,
        pushTokensCount: tokens.length,
        notificationsInserted: notificationsRows.length,
        expoResponse,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
