import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function icalDate(iso: string): string {
  // Convert YYYY-MM-DD to YYYYMMDD
  return iso.replace(/-/g, '')
}

function icalDateNext(iso: string): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0].replace(/-/g, '')
}

function icalNow(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('T', 'T')
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = createAdminClient()

  // Validate household
  const { data: household } = await supabase
    .from('households')
    .select('id, name')
    .eq('id', token)
    .maybeSingle()

  if (!household) {
    return new Response('Household not found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  }

  // Fetch incomplete chores with a due date
  const { data: chores } = await supabase
    .from('chores')
    .select('id, name, description, due_date, assigned_to, priority, category')
    .eq('household_id', token)
    .neq('status', 'completed')
    .not('due_date', 'is', null)

  if (!chores) {
    return new Response('Failed to fetch chores', { status: 500, headers: { 'Content-Type': 'text/plain' } })
  }

  // Collect unique assignee IDs
  const assigneeIds = [...new Set(chores.map(c => c.assigned_to).filter(Boolean))] as string[]

  // Fetch assignee names
  const assigneeMap: Record<string, string> = {}
  if (assigneeIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', assigneeIds)
    for (const u of (users ?? []) as { id: string; full_name: string | null }[]) {
      assigneeMap[u.id] = u.full_name ?? 'Unknown'
    }
  }

  const householdName = (household as { id: string; name: string }).name
  const now = icalNow()

  const events = (chores as {
    id: string
    name: string
    description: string | null
    due_date: string
    assigned_to: string | null
    priority: string
    category: string
  }[]).map(chore => {
    const assigneeName = chore.assigned_to ? assigneeMap[chore.assigned_to] : null
    const descLines = [
      `Category: ${chore.category}`,
      `Priority: ${chore.priority}`,
      ...(assigneeName ? [`Assigned to: ${assigneeName}`] : []),
    ]

    return [
      'BEGIN:VEVENT',
      `UID:${chore.id}@choresync`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${icalDate(chore.due_date)}`,
      `DTEND;VALUE=DATE:${icalDateNext(chore.due_date)}`,
      `SUMMARY:${escapeText(chore.name)}`,
      `DESCRIPTION:${escapeText(descLines.join('\n'))}`,
      `CATEGORIES:${chore.category.toUpperCase()}`,
      'END:VEVENT',
    ].join('\r\n')
  }).join('\r\n')

  const cal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ChoreSync//EN',
    `X-WR-CALNAME:ChoreSync — ${escapeText(householdName)}`,
    'X-WR-TIMEZONE:UTC',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  return new Response(cal, {
    status: 200,
    headers: {
      'Content-Type':        'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="choresync.ics"',
      'Cache-Control':       'no-cache',
    },
  })
}
