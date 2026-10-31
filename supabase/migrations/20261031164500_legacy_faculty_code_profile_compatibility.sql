create or replace function private.normalize_ut_faculty(p_faculty text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case upper(btrim(coalesce(p_faculty, '')))
    when 'FEB' then 'Fakultas Ekonomi dan Bisnis (FEB)'
    when 'FAKULTAS EKONOMI DAN BISNIS' then 'Fakultas Ekonomi dan Bisnis (FEB)'
    when 'FKIP' then 'Fakultas Keguruan dan Ilmu Pendidikan (FKIP)'
    when 'FAKULTAS KEGURUAN DAN ILMU PENDIDIKAN' then 'Fakultas Keguruan dan Ilmu Pendidikan (FKIP)'
    when 'FST' then 'Fakultas Sains dan Teknologi (FST)'
    when 'FAKULTAS SAINS DAN TEKNOLOGI' then 'Fakultas Sains dan Teknologi (FST)'
    when 'FHISIP' then 'Fakultas Hukum, Ilmu Sosial, dan Ilmu Politik (FHISIP)'
    when 'FAKULTAS HUKUM, ILMU SOSIAL, DAN ILMU POLITIK' then 'Fakultas Hukum, Ilmu Sosial, dan Ilmu Politik (FHISIP)'
    else btrim(coalesce(p_faculty, ''))
  end;
$function$;

create or replace function private.is_valid_ut_program(p_faculty text, p_program text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select case private.normalize_ut_faculty(p_faculty)
    when 'Fakultas Ekonomi dan Bisnis (FEB)' then p_program = any(array[
      'Manajemen','Ekonomi Pembangunan','Ekonomi Syariah','Akuntansi',
      'Akuntansi Keuangan Publik','Pariwisata','Kewirausahaan'
    ]::text[])
    when 'Fakultas Hukum, Ilmu Sosial, dan Ilmu Politik (FHISIP)' then p_program = any(array[
      'Ilmu Administrasi Publik','Administrasi Bisnis','Hukum','Ilmu Pemerintahan',
      'Ilmu Komunikasi','Perpustakaan dan Sains Informasi','Sosiologi','Sastra Inggris','Perpajakan'
    ]::text[])
    when 'Fakultas Keguruan dan Ilmu Pendidikan (FKIP)' then p_program = any(array[
      'Pendidikan Bahasa dan Sastra Indonesia','Pendidikan Bahasa Inggris','Pendidikan Biologi',
      'Pendidikan Fisika','Pendidikan Kimia','Pendidikan Matematika','Pendidikan Ekonomi',
      'Pendidikan Pancasila dan Kewarganegaraan','Teknologi Pendidikan',
      'Pendidikan Guru Sekolah Dasar (PGSD)',
      'Pendidikan Guru Pendidikan Anak Usia Dini (PGPAUD)','Pendidikan Agama Islam (PAI)'
    ]::text[])
    when 'Fakultas Sains dan Teknologi (FST)' then p_program = any(array[
      'Statistika','Matematika','Biologi','Teknologi Pangan','Agribisnis',
      'Perencanaan Wilayah dan Kota','Sistem Informasi','Sains Data'
    ]::text[])
    else false
  end;
$function$;

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
  v_faculty text := private.normalize_ut_faculty(p_faculty);
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
  if not private.is_valid_ut_program(v_faculty, v_program) then
    raise exception 'Program studi tidak sesuai dengan katalog resmi UT' using errcode = '22023';
  end if;
  if p_semester is null or p_semester not between 1 and 16 then
    raise exception 'Semester harus berada pada rentang 1–16' using errcode = '22023';
  end if;
  if v_bio is not null and char_length(v_bio) > 280 then
    raise exception 'Bio maksimal 280 karakter' using errcode = '22023';
  end if;

  select * into v_current
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Student profile not found' using errcode = 'P0002';
  end if;

  v_identity_changed :=
    v_full_name is distinct from v_current.full_name
    or v_faculty is distinct from private.normalize_ut_faculty(v_current.faculty)
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
      and v_identity_changed then 'pending'::public.student_verification_status
    else v_current.verification_status
  end;

  update public.profiles
  set full_name = v_full_name,
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
    'avatar_path', v_current.avatar_path,
    'verification_status', v_current.verification_status,
    'updated_at', v_current.updated_at,
    'identity_changed', v_identity_changed
  );
end
$function$;

revoke all on function private.normalize_ut_faculty(text) from public, anon, authenticated;
revoke all on function private.is_valid_ut_program(text, text) from public, anon, authenticated;
revoke all on function public.update_my_student_profile(text, text, text, smallint, text, boolean) from public, anon;
grant execute on function public.update_my_student_profile(text, text, text, smallint, text, boolean) to authenticated;
