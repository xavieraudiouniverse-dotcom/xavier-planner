import type { PlannerTask, PlannerLevel } from '@/lib/types';

const MODELS = [
  'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
  'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
  'Qwen2.5-0.5B-Instruct-q4f32_1-MLC',
  'Llama-3.2-1B-Instruct-q4f16_1-MLC',
] as const;

export function instantBreakdown(parent: PlannerTask, childLevel: PlannerLevel): PlannerTask[] {
  const count = childLevel === 'monthly' ? 6 : childLevel === 'weekly' ? 5 : childLevel === 'daily' ? 6 : 4;
  const verbs = ['Clarify', 'Prepare', 'Execute', 'Review', 'Improve', 'Document', 'Share', 'Lock in'];
  return Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(),
    parentId: parent.id,
    title: `${verbs[index % verbs.length]}: ${parent.title}`,
    notes: `Generated smart step for ${parent.title}. Adjust the date, files, people, budget and checklist as needed.`,
    level: childLevel,
    startDate: parent.startDate,
    dueDate: parent.dueDate,
    startTime: '',
    endTime: '',
    priority: index < 2 ? 'high' : 'medium',
    status: 'planned',
    area: parent.area,
    estimateMinutes: childLevel === 'daily' ? 45 : 180,
    tags: [...new Set([...parent.tags, 'ai-template'])],
    links: [parent.id],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

async function cloudflareBreakdown(parent: PlannerTask, childLevel: PlannerLevel): Promise<PlannerTask[]> {
  const response = await fetch('/api/ai/breakdown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parent, childLevel }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Cloudflare AI failed (${response.status}).`);
  }

  const body = (await response.json()) as { tasks?: PlannerTask[] };
  if (!body.tasks?.length) throw new Error('Cloudflare Qwen returned no tasks.');
  return body.tasks;
}

async function localWebLLMBreakdown(
  parent: PlannerTask,
  childLevel: PlannerLevel,
  onProgress: (message: string) => void,
): Promise<PlannerTask[]> {
  if (!('gpu' in navigator)) throw new Error('This device/browser does not expose WebGPU.');

  const webllm = await import('@mlc-ai/web-llm');
  const available = new Set(webllm.prebuiltAppConfig.model_list.map((model) => model.model_id));
  const modelId = MODELS.find((id) => available.has(id));
  if (!modelId) throw new Error('No compatible local Qwen/Llama model is available.');

  const worker = new Worker(new URL('./local-ai.worker.ts', import.meta.url), { type: 'module' });
  try {
    const engine = await webllm.CreateWebWorkerMLCEngine(worker, modelId, {
      initProgressCallback: (p) => onProgress(p.text),
    });
    onProgress(`Cloud AI unavailable. Running ${modelId} locally…`);

    const completion = await engine.chat.completions.create({
      temperature: 0.25,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Return JSON only: {"steps":[{"title":"specific action","notes":"practical note","estimateMinutes":number,"priority":"low|medium|high|urgent"}]}. Do not claim the work is done.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            goal: parent.title,
            notes: parent.notes,
            childLevel,
            dates: { start: parent.startDate, due: parent.dueDate },
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message.content || '{}';
    const parsed = JSON.parse(raw) as {
      steps?: Array<{ title?: string; notes?: string; estimateMinutes?: number; priority?: PlannerTask['priority'] }>;
    };
    const steps = parsed.steps?.slice(0, 12) || [];
    if (!steps.length) throw new Error('Local AI returned no steps.');

    return steps.map((step) => ({
      id: crypto.randomUUID(),
      parentId: parent.id,
      title: String(step.title || `Step for ${parent.title}`).slice(0, 260),
      notes: String(step.notes || '').slice(0, 3000),
      level: childLevel,
      startDate: parent.startDate,
      dueDate: parent.dueDate,
      startTime: '',
      endTime: '',
      priority: step.priority || 'medium',
      status: 'planned',
      area: parent.area,
      estimateMinutes: Number(step.estimateMinutes || 60),
      tags: [...new Set([...parent.tags, 'qwen-local'])],
      links: [parent.id],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  } finally {
    worker.terminate();
  }
}

export async function qwenOrLlamaBreakdown(
  parent: PlannerTask,
  childLevel: PlannerLevel,
  onProgress: (message: string) => void,
): Promise<PlannerTask[]> {
  try {
    onProgress('Connecting to Qwen on Cloudflare Workers AI…');
    const tasks = await cloudflareBreakdown(parent, childLevel);
    onProgress('Qwen completed the plan on Cloudflare.');
    return tasks;
  } catch (cloudError) {
    console.warn('Cloudflare Qwen unavailable; trying local WebLLM.', cloudError);
  }

  try {
    return await localWebLLMBreakdown(parent, childLevel, onProgress);
  } catch (localError) {
    console.warn('Local AI unavailable; using instant planner template.', localError);
    onProgress('AI unavailable on this request. Using the instant planner fallback.');
    return instantBreakdown(parent, childLevel);
  }
}
