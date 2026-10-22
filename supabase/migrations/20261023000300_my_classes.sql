-- The classes the signed-in teacher teaches. A teacher cannot read the staff register (admin-only),
-- so this SECURITY DEFINER function resolves their classes safely, filtered to their own user id.
-- It returns only class basics and never another user's or school's data.
create or replace function public.my_classes()
returns table (
  id uuid, school_id uuid, academic_year int, grade_code text, name text, is_class_teacher boolean
) language sql stable security definer set search_path = public as $$
  select c.id, c.school_id, c.academic_year, c.grade_code, c.name,
    exists (select 1 from public.staff_members sm where sm.id = c.class_teacher_id and sm.user_id = auth.uid()) as is_class_teacher
  from public.classes c
  where exists (select 1 from public.staff_members sm where sm.id = c.class_teacher_id and sm.user_id = auth.uid())
     or exists (
       select 1 from public.class_subject_teachers cst
       join public.staff_members sm on sm.id = cst.teacher_id
       where cst.class_id = c.id and sm.user_id = auth.uid()
     )
  order by c.academic_year desc, c.grade_code, c.name;
$$;
