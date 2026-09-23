import type {Task,Level} from './model';
import {blankTask,parseDate,dateKey,addDays} from './model';
const candidates=['Qwen2.5-1.5B-Instruct-q4f32_1-MLC','Qwen2.5-0.5B-Instruct-q4f32_1-MLC','Llama-3.2-1B-Instruct-q4f32_1-MLC'];
export async function generateSteps(task:Task,level:Level,onProgress:(s:string)=>void):Promise<Task[]>{
 if(!('gpu' in navigator))throw Error('WebGPU unavailable on this browser. Use instant smart templates instead.');
 const webllm=await import('@mlc-ai/web-llm');const list=new Set(webllm.prebuiltAppConfig.model_list.map(m=>m.model_id));const chosen=candidates.find(id=>list.has(id));if(!chosen)throw Error('No compatible Qwen/Llama model was found in this WebLLM version. Use templates.');
 const worker=new Worker(new URL('./local-ai.worker.ts',import.meta.url),{type:'module'});
 try {const engine=await webllm.CreateWebWorkerMLCEngine(worker,chosen,{initProgressCallback:p=>onProgress(p.text)});onProgress(`Generating privately with ${chosen}…`);
 const response=await engine.chat.completions.create({messages:[{role:'system',content:'Create practical task breakdown. Return only a JSON object with tasks array of 3 to 6 objects with title and notes strings. Avoid generic placeholder steps.'},{role:'user',content:JSON.stringify({goal:task.title,context:task.notes,level,deadline:task.due})}],temperature:0.35,max_tokens:700,response_format:{type:'json_object'}});
 const parsed=JSON.parse(response.choices[0]?.message.content||'{}') as {tasks?:{title?:unknown;notes?:unknown}[]};if(!Array.isArray(parsed.tasks))throw Error('AI returned an invalid plan. Try templates.');const steps=parsed.tasks.filter(t=>typeof t.title==='string'&&t.title.trim()).slice(0,6);if(!steps.length)throw Error('No usable steps returned.');const start=parseDate(task.start_date||task.due);const end=parseDate(task.due);return steps.map((s,i)=>{const d=addDays(start,Math.max(0,Math.floor(((end.getTime()-start.getTime())/86400000)*(i+1)/steps.length)));return {...blankTask(level,d,task.id),title:String(s.title).slice(0,300),notes:typeof s.notes==='string'?s.notes.slice(0,5000):'',start_date:dateKey(d),due:dateKey(d)}})} finally {worker.terminate()}
}
