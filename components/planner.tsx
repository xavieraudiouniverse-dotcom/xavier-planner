'use client';

import { useEffect, useState } from 'react';
import type { Task, Level } from '@/lib/planner';
import { levels, descendants } from '@/lib/planner';
import { breakdown } from '@/lib/free-planner';

const today = () => new Date().toLocaleDateString('en-CA');
const emptyTask = (level: Level): Task => ({ id: crypto.randomUUID(), parent_id: null, title: '', notes: '', level, due: today(), done: false });

export function Planner() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [level, setLevel] = useState<Level>('yearly');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => { const raw = localStorage.getItem('xavier-planner-v1'); if (raw) setTasks(JSON.parse(raw).tasks ?? []); }, []);
  function save(next: Task[]) { setTasks(next); localStorage.setItem('xavier-planner-v1', JSON.stringify({ tasks: next })); }
  function add(event: React.FormEvent) { event.preventDefault(); if (!title.trim()) return; save([...tasks, { ...emptyTask(level), title: title.trim(), notes }]); setTitle(''); setNotes(''); }
  function remove(task: Task) { const ids = descendants(task.id, tasks); save(tasks.filter(item => !ids.has(item.id))); }
  const visible = tasks.filter(task => task.level === level);

  return <div className="app"><header className="topbar"><a className="brand" href="/">XAVIER PLANNER</a><span>Saved on this device</span></header><main><div className="heading"><div><p className="eyebrow">THE BIG PICTURE. THE NEXT STEP.</p><h1>Make room for progress.</h1><p className="subtext">One year. Clear milestones. Small steps that add up.</p></div><button className="primary" onClick={() => setLevel('yearly')}>New yearly goal</button></div><section className="card"><div className="toolbar">{levels.map(item => <button className={level === item ? 'primary' : ''} key={item} onClick={() => setLevel(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div><form onSubmit={add}><label>Title<input value={title} onChange={e => setTitle(e.target.value)} placeholder={`Add a ${level} ${level === 'yearly' ? 'goal' : 'task'}`} /></label><label>Notes<textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="What would success look like?" /></label><button className="primary" type="submit">Add {level}</button></form>{visible.length === 0 ? <div className="empty">No {level} items yet.</div> : visible.map(task => <article className="task" key={task.id}><input type="checkbox" checked={task.done} onChange={e => save(tasks.map(item => item.id === task.id ? { ...item, done: e.target.checked } : item))} /><div className="task-content"><div className={`task-title ${task.done ? 'done' : ''}`}>{task.title}</div>{task.notes && <div className="task-meta">{task.notes}</div>}<div className="task-meta">Due {task.due}</div></div>{task.level !== 'daily' && <button onClick={() => { save([...tasks, ...breakdown(task)]); setMessage('Template steps added.'); }}>Break down</button>}<button onClick={() => remove(task)}>Delete</button></article>)}</section>{message && <div className="notice">{message}</div>}</main></div>;
}
