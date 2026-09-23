import { z } from 'zod';

export const levels = ['yearly', 'monthly', 'weekly', 'daily'] as const;
export type Level = typeof levels[number];
export const taskSchema = z.object({ id: z.string().uuid(), parent_id: z.string().uuid().nullable(), title: z.string().min(1).max(300), notes: z.string().max(5000), level: z.enum(levels), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), done: z.boolean() });
export type Task = z.infer<typeof taskSchema>;
export const planSchema = z.object({ tasks: z.array(taskSchema).max(1000) });
export function validateTree(tasks: Task[]) { const ids = new Set(tasks.map(t => t.id)); if (ids.size !== tasks.length) throw Error('Duplicate tasks'); for (const task of tasks) if (task.parent_id) { const parent = tasks.find(t => t.id === task.parent_id); if (!parent || levels.indexOf(task.level) !== levels.indexOf(parent.level) + 1) throw Error('Invalid hierarchy'); } return tasks; }
export function descendants(id: string, tasks: Task[]): Set<string> { const result = new Set([id]); for (const task of tasks.filter(t => t.parent_id === id)) for (const child of descendants(task.id, tasks)) result.add(child); return result; }
