import type { Task } from './planner';
import { levels } from './planner';

function iso(date: Date) { return date.toLocaleDateString('en-CA'); }
export function breakdown(parent: Task, now = new Date()): Task[] { const next = levels[levels.indexOf(parent.level) + 1]; if (!next) return []; const end = new Date(`${parent.due}T12:00:00`); const start = new Date(`${iso(now)}T12:00:00`); const dates: string[] = []; const cursor = end < start ? end : start; while (cursor <= end && dates.length < 6) { dates.push(iso(cursor)); cursor.setDate(cursor.getDate() + (next === 'weekly' ? 7 : next === 'monthly' ? 30 : 1)); } return dates.map((due, i) => ({ id: crypto.randomUUID(), parent_id: parent.id, title: `Next ${next} step ${i + 1}: ${parent.title}`.slice(0, 300), notes: 'Free template suggestion. Edit this into a specific action.', level: next, due, done: false })); }
