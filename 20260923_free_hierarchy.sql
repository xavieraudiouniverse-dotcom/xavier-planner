-- Existing FK ensures the parent belongs to the same user. Allow any planning level to contain any other.
-- User can create goals from any level and link other levels without arbitrary adjacency rules.
-- Cycle checking in frontend plus database trigger prevents impossible nesting.
create or replace function public.planner_check_parent_cycle() returns trigger language plpgsql set search_path='' as $$
declare cursor_id uuid; seen uuid[] := array[new.id];
begin
 cursor_id := new.parent_id;
 while cursor_id is not null loop
  if cursor_id = any(seen) then raise exception 'Circular planner hierarchy is not permitted'; end if;
  seen := array_append(seen,cursor_id);
  select parent_id into cursor_id from public.planner_tasks where id = cursor_id and user_id = new.user_id;
 end loop;
 return new;
end;
$$;
drop trigger if exists planner_prevent_cycle on public.planner_tasks;
create trigger planner_prevent_cycle before insert or update of parent_id on public.planner_tasks for each row execute function public.planner_check_parent_cycle();
