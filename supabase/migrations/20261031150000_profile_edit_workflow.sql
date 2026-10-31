-- Secure owner-only profile edits and force re-verification after identity changes.

-- The browser must not update academic identity columns directly. Updates go
-- through the RPC below, which can reset an existing verified status safely.
revoke update (full_name, faculty, program, semester)
on table public.profiles
from authenticated;

create or replace function public.update_my_student_profile(
  p_full_name text,
  p_faculty text,
  p_program text,
  p_semester smallint,
  p_bio text,
  p_acknowledge_verification_reset boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_current public.profiles%rowtype;
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_faculty text := btrim(coalesce(p_faculty, ''));
  v_program text := btrim(coalesce(p_program, ''));
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_identity_changed boolean;
  v_next_status public.student_verification_status;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if char_length(v_full_name) not between 2 and 100 then
    raise exception 'Nama lengkap harus berisi 2–100 karakter' using errcode = '22023';
  end if;
  if char_length(v_faculty) not between 2 and 80 then
    raise exception 'Nama fakultas harus berisi 2–80 karakter' using errcode = '22023';
  end if;
  if char_length(v_program) not between 2 and 100 then
    raise exception 'Nama program studi harus berisi 2–100 karakter' using errcode = '22023';
  end if;
  if p_semester is null or p_semester not between 1 and 16 then
    raise exception 'Semester harus berada pada rentang 1–16' using errcode = '22023';
  end if;
  if v_bio is not null and char_length(v_bio) > 280 then
    raise exception 'Bio maksimal 280 karakter' using errcode = '22023';
  end if;

  select *
  into v_current
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Student profile not found' using errcode = 'P0002';
  end if;

  v_identity_changed :=
    v_full_name is distinct from v_current.full_name
    or v_faculty is distinct from v_current.faculty
    or v_program is distinct from v_current.program
    or p_semester is distinct from v_current.semester;

  if v_current.verification_status = 'verified'::public.student_verification_status
    and v_identity_changed
    and coalesce(p_acknowledge_verification_reset, false) is not true
  then
    raise exception 'Perubahan data akademik akan mengembalikan status verifikasi menjadi pending. Konfirmasi terlebih dahulu.' using errcode = '22023';
  end if;

  v_next_status := case
    when v_current.verification_status = 'verified'::public.student_verification_status
      and v_identity_changed
      then 'pending'::public.student_verification_status
    else v_current.verification_status
  end;

  update public.profiles
  set
    full_name = v_full_name,
    faculty = v_faculty,
    program = v_program,
    semester = p_semester,
    bio = v_bio,
    verification_status = v_next_status
  where id = v_user_id
  returning * into v_current;

  return jsonb_build_object(
    'id', v_current.id,
    'full_name', v_current.full_name,
    'faculty', v_current.faculty,
    'program', v_current.program,
    'semester', v_current.semester,
    'bio', v_current.bio,
    'verification_status', v_current.verification_status,
    'updated_at', v_current.updated_at,
    'identity_changed', v_identity_changed
  );
end;
$function$;

revoke all on function public.update_my_student_profile(text, text, text, smallint, text, boolean)
from public, anon, authenticated;
grant execute on function public.update_my_student_profile(text, text, text, smallint, text, boolean)
to authenticated, service_role;
