import { z } from 'zod';
import type { Task } from './planner';
import { breakdown } from './free-planner';

const MODEL_IDS = [
  // Best balance for capable phones and laptops.
  'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
  // Fallback for low-memory devices.
  'Qwen2.5-0.5B-Instruct-q4f32_1-MLC',
  // Optional fallback if a WebLLM release exposes this model.
  'Llama-3.2-1B-Instruct-q4f32_1-MLC',
] as const;

let worker: Worker | null = null;
let cancel: (() => void) | null = null;

export function cancelLocalAI() {
  cancel?.();
  worker?.terminate();
  worker = null;
  cancel = null;
}

export async function localBreakdown(
  parent: Task,
  onProgress: (text: string) => void,
): Promise<Task[]> {
  if (!('gpu' in navigator)) {
    throw Error('This browser does not support on-device AI. Use free templates instead.');
  }

  const base = breakdown(parent);
  if (!base.length) return [];

  const webllm = await import('@mlc-ai/web-llm');
  const available = new Set(webllm.prebuiltAppConfig.model_list.map((model) => model.model_id));
  const modelId = MODEL_IDS.find((id) => available.has(id));
  if (!modelId) {
    throw Error('No compatible lightweight Qwen/Llama model is available in this WebLLM build.');
  }

  worker = new Worker(new URL('./local-ai.worker.ts', import.meta.url), { type: 'module' });
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const stopped = new Promise<never>((_, reject) => {
    cancel = () => reject(Error('On-device AI stopped. Free template suggestions remain available.'));
    timeout = setTimeout(
      () => reject(Error('On-device AI took too long. Try the templates or a faster device.')),
      240000,
    );
  });

  try {
    return await Promise.race([
      (async () => {
        const engine = await webllm.CreateWebWorkerMLCEngine(worker!, modelId, {
          initProgressCallback: (progress) => onProgress(progress.text),
        });
        onProgress(`Writing suggestions with ${modelId.startsWith('Qwen') ? 'Qwen' : 'Llama'} on your device…`);

        const reply = await engine.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'Return JSON only: {"tasks":[{"title":"specific actionable step","notes":"short explanation"}]}. Do not claim work is complete. Keep steps practical and concise.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                goal: parent.title,
                notes: parent.notes.slice(0, 1000),
                childLevel: base[0].level,
                numberOfTasks: Math.min(base.length, 6),
                dueDates: base.slice(0, 6).map((task) => task.due),
              }),
            },
          ],
          temperature: 0.3,
          max_tokens: 1200,
          response_format: { type: 'json_object' },
        });

        const raw = reply.choices[0]?.message.content || '';
        const parsed = z.object({
          tasks: z.array(z.object({
            title: z.string().min(1).max(300),
            notes: z.string().max(5000),
          })).min(1).max(12),
        }).parse(JSON.parse(raw));

        return parsed.tasks.slice(0, base.length).map((task, index) => ({ ...base[index], ...task }));
      })(),
      stopped,
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    worker?.terminate();
    worker = null;
    cancel = null;
  }
}
