import type { PlannerLevel, PlannerTask } from '@/lib/types';

export const maxDuration = 30;

const MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';

type Step = {
  title?: string;
  notes?: string;
  estimateMinutes?: number;
  priority?: PlannerTask['priority'];
};

type CloudflareResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

function validPriority(value: unknown): PlannerTask['priority'] {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'urgent' ? value : 'medium';
}

export async function POST(req: Request) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiKey = process.env.CLOUDFLARE_AI_API_TOKEN;

  if (!accountId || !apiKey) {
    return Response.json({ error: 'Cloudflare Workers AI is not configured.' }, { status: 503 });
  }

  const body = (await req.json()) as { parent?: PlannerTask; childLevel?: PlannerLevel };
  const parent = body.parent;
  const childLevel = body.childLevel;

  if (!parent?.id || !parent?.title || !childLevel) {
    return Response.json({ error: 'Missing parent task or child level.' }, { status: 400 });
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.25,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Return JSON only in this exact shape: {"steps":[{"title":"specific action","notes":"practical note","estimateMinutes":60,"priority":"low|medium|high|urgent"}]}. Produce practical, non-duplicative steps. Do not claim work has already been completed.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              goal: String(parent.title).slice(0, 500),
              notes: String(parent.notes || '').slice(0, 4000),
              childLevel,
              dates: { start: parent.startDate, due: parent.dueDate },
              area: parent.area,
            }),
          },
        ],
      }),
      cache: 'no-store',
    },
  );

  const data = (await response.json()) as CloudflareResponse;
  if (!response.ok) {
    return Response.json({ error: data.error?.message || `Cloudflare AI request failed (${response.status}).` }, { status: 502 });
  }

  const raw = data.choices?.[0]?.message?.content || '{}';
  let parsed: { steps?: Step[] };
  try {
    parsed = JSON.parse(raw) as { steps?: Step[] };
  } catch {
    return Response.json({ error: 'Qwen returned invalid JSON.' }, { status: 502 });
  }

  const steps = (parsed.steps || []).slice(0, 12);
  if (!steps.length) return Response.json({ error: 'Qwen returned no planning steps.' }, { status: 502 });

  const now = new Date().toISOString();
  const tasks: PlannerTask[] = steps.map((step) => ({
    id: crypto.randomUUID(),
    parentId: parent.id,
    title: String(step.title || `Step for ${parent.title}`).slice(0, 260),
    notes: String(step.notes || '').slice(0, 3000),
    level: childLevel,
    startDate: parent.startDate,
    dueDate: parent.dueDate,
    startTime: '',
    endTime: '',
    priority: validPriority(step.priority),
    status: 'planned',
    area: parent.area,
    estimateMinutes: Math.max(5, Math.min(10080, Number(step.estimateMinutes || 60))),
    tags: [...new Set([...(parent.tags || []), 'qwen-cloudflare'])],
    links: [parent.id],
    createdAt: now,
    updatedAt: now,
  }));

  return Response.json({ tasks, model: MODEL });
}
