-- Coverage guard: fails if the shape that keeps tenants apart ever regresses. Reads catalogs only,
-- makes no changes. Run by `npm run test:rls` alongside tenant_isolation.sql.
--
-- It fails if any public base table has row-level security disabled (such a table is wide open to
-- every signed-in user through PostgREST), if any SECURITY DEFINER function does not pin its
-- search_path (a privilege-escalation vector), or if any public view is not security_invoker (a
-- definer view would read underlying tables without the caller's row security).

do $$
declare v_fail text[] := '{}'; r record;
begin
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
  loop
    v_fail := v_fail || format('table %s has RLS disabled', r.relname);
  end loop;

  for r in
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')
  loop
    v_fail := v_fail || format('SECURITY DEFINER function %s does not pin search_path', r.proname);
  end loop;

  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
      and coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), 'false') <> 'true'
  loop
    v_fail := v_fail || format('view %s is not security_invoker', r.relname);
  end loop;

  if array_length(v_fail, 1) is null then
    raise exception 'SKOOLO_RLS_TESTS_PASSED: coverage ok';
  else
    raise exception 'SKOOLO_RLS_TESTS_FAILED (coverage): %', array_to_string(v_fail, ' | ');
  end if;
end $$;
