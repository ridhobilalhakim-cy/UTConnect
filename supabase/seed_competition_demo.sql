-- UT Connect competition demo seed. Safe to re-run: stable demo UUIDs and upserts.
-- This is STAGING-ONLY. It marks existing administrator accounts as verified demo presenters
-- so the verified-student workflows can be exercised during the competition.
-- Synthetic bot accounts are clearly labeled and use reserved .test emails.

begin;

-- Designate the existing UT Connect administrators as demo presenters in this staging project.
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('utconnect_demo_presenter', true)
where id in (select user_id from private.app_user_roles where role = 'admin');

update public.profiles
set verification_status = 'verified'::public.student_verification_status,
    updated_at = now()
where id in (select user_id from private.app_user_roles where role = 'admin');

create temp table utconnect_demo_bots (
  id uuid primary key,
  email text not null,
  full_name text not null,
  faculty text not null,
  program text not null,
  semester smallint not null,
  home_admin_id uuid not null,
  offset_m double precision not null,
  angle_deg double precision not null,
  topic_tags text[] not null,
  interests text[] not null,
  study_times text[] not null,
  course_codes text[] not null
) on commit drop;

insert into utconnect_demo_bots values
('b0000000-0000-4000-8000-000000000001','bot.nabila.01@demo.utconnect.test','Bot Nabila Putri','Fakultas Sains dan Teknologi','Sistem Informasi • BOT DEMO',3,'4cbf0d2b-8c73-49f0-8939-c44eb32fd58f',350,25,array['UI/UX','Basis Data'],array['Desain aplikasi','Membaca'],array['Malam','Akhir pekan'],array['DEMO-SI101','DEMO-UT102']),
('b0000000-0000-4000-8000-000000000002','bot.farhan.02@demo.utconnect.test','Bot Farhan Akbar','Fakultas Sains dan Teknologi','Sistem Informasi • BOT DEMO',4,'4cbf0d2b-8c73-49f0-8939-c44eb32fd58f',900,90,array['Pemrograman','Analisis Sistem'],array['Web development','Teknologi'],array['Pagi','Malam'],array['DEMO-SI101','DEMO-SI202']),
('b0000000-0000-4000-8000-000000000003','bot.citra.03@demo.utconnect.test','Bot Citra Maharani','Fakultas Ekonomi dan Bisnis','Manajemen • BOT DEMO',5,'4cbf0d2b-8c73-49f0-8939-c44eb32fd58f',1500,160,array['Manajemen','Kewirausahaan'],array['Bisnis digital','Membaca'],array['Sore','Akhir pekan'],array['DEMO-UT102','DEMO-STAT103']),
('b0000000-0000-4000-8000-000000000004','bot.rafi.04@demo.utconnect.test','Bot Rafi Ramadhan','Fakultas Sains dan Teknologi','Sistem Informasi • BOT DEMO',2,'4cbf0d2b-8c73-49f0-8939-c44eb32fd58f',2400,230,array['Jaringan','Pemrograman'],array['Keamanan digital','Game'],array['Malam'],array['DEMO-SI202']),
('b0000000-0000-4000-8000-000000000005','bot.salma.05@demo.utconnect.test','Bot Salma Zahra','Fakultas Keguruan dan Ilmu Pendidikan','Pendidikan Bahasa Inggris • BOT DEMO',6,'228d4d62-a223-4ead-92cc-d3480101c1de',400,40,array['Bahasa Inggris','Literasi'],array['Menulis','Film edukasi'],array['Pagi','Sore'],array['DEMO-UT102']),
('b0000000-0000-4000-8000-000000000006','bot.dimas.06@demo.utconnect.test','Bot Dimas Pratama','Fakultas Sains dan Teknologi','Sistem Informasi • BOT DEMO',3,'228d4d62-a223-4ead-92cc-d3480101c1de',1000,120,array['Data','Statistika'],array['Analisis data','Olahraga'],array['Malam'],array['DEMO-STAT103','DEMO-SI101']),
('b0000000-0000-4000-8000-000000000007','bot.alya.07@demo.utconnect.test','Bot Alya Safitri','Fakultas Ekonomi dan Bisnis','Akuntansi • BOT DEMO',4,'228d4d62-a223-4ead-92cc-d3480101c1de',1700,205,array['Akuntansi','Bisnis'],array['Keuangan','Organisasi'],array['Sore','Akhir pekan'],array['DEMO-UT102']),
('b0000000-0000-4000-8000-000000000008','bot.rizky.08@demo.utconnect.test','Bot Rizky Maulana','Fakultas Sains dan Teknologi','Sains Data • BOT DEMO',2,'228d4d62-a223-4ead-92cc-d3480101c1de',2600,290,array['Python','Statistika'],array['Data science','Teknologi'],array['Pagi','Malam'],array['DEMO-STAT103','DEMO-SI202']),
('b0000000-0000-4000-8000-000000000009','bot.hana.09@demo.utconnect.test','Bot Hana Azzahra','Fakultas Keguruan dan Ilmu Pendidikan','Pendidikan Matematika • BOT DEMO',5,'cd3e82a5-8d6a-4e56-9400-c0d6423c0ab4',450,15,array['Matematika','Statistika'],array['Mengajar','Puzzle'],array['Pagi','Sore'],array['DEMO-STAT103']),
('b0000000-0000-4000-8000-000000000010','bot.fajar.10@demo.utconnect.test','Bot Fajar Nugraha','Fakultas Sains dan Teknologi','Sistem Informasi • BOT DEMO',6,'cd3e82a5-8d6a-4e56-9400-c0d6423c0ab4',950,100,array['UI/UX','Mobile'],array['Desain','Aplikasi mobile'],array['Malam'],array['DEMO-SI101','DEMO-SI202']),
('b0000000-0000-4000-8000-000000000011','bot.siti.11@demo.utconnect.test','Bot Siti Rahma','Fakultas Ilmu Sosial dan Ilmu Politik','Ilmu Komunikasi • BOT DEMO',3,'cd3e82a5-8d6a-4e56-9400-c0d6423c0ab4',1600,185,array['Komunikasi','Public speaking'],array['Konten digital','Relawan'],array['Sore','Akhir pekan'],array['DEMO-UT102']),
('b0000000-0000-4000-8000-000000000012','bot.reza.12@demo.utconnect.test','Bot Reza Prakoso','Fakultas Sains dan Teknologi','Sistem Informasi • BOT DEMO',1,'cd3e82a5-8d6a-4e56-9400-c0d6423c0ab4',2500,275,array['Database','Web'],array['Coding','Musik'],array['Malam'],array['DEMO-SI101','DEMO-SI202']);

-- Create non-login demo identities. The passwords are random hashes; these bot accounts are data actors,
-- not credentials for people to sign in as.
insert into auth.users
  (id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
select
  b.id, 'authenticated', 'authenticated', b.email,
  extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
  now(),
  jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
  jsonb_build_object('full_name',b.full_name,'utconnect_demo_bot',true,'demo_only',true),
  now(), now(), false, false
from utconnect_demo_bots b
on conflict (id) do update
set email = excluded.email,
    email_confirmed_at = excluded.email_confirmed_at,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

insert into public.profiles
  (id, full_name, nim_digest, faculty, program, semester, verification_status, bio, created_at, updated_at)
select
  b.id, b.full_name,
  md5('UTCONNECT-DEMO-NIM:' || b.id::text) || md5('UTCONNECT-DEMO:' || b.email),
  b.faculty, b.program, b.semester,
  'verified'::public.student_verification_status,
  'AKUN BOT DEMO SINTETIS UT CONNECT. Bukan mahasiswa sungguhan dan hanya digunakan untuk demonstrasi fitur.',
  now(), now()
from utconnect_demo_bots b
on conflict (id) do update
set full_name = excluded.full_name,
    faculty = excluded.faculty,
    program = excluded.program,
    semester = excluded.semester,
    verification_status = 'verified'::public.student_verification_status,
    bio = excluded.bio,
    updated_at = now();

-- Put bot pins around each existing admin presenter location. Coordinates remain server-protected
-- and the public map continues to return the application's jittered marker coordinates only.
insert into public.user_locations (user_id, location, show_in_radar, consented_at, updated_at)
select
  b.id,
  extensions.st_project(home.location, b.offset_m, radians(b.angle_deg)),
  true, now(), now()
from utconnect_demo_bots b
join public.user_locations home on home.user_id = b.home_admin_id
on conflict (user_id) do update
set location = excluded.location,
    show_in_radar = true,
    consented_at = excluded.consented_at,
    updated_at = now();

insert into public.courses (course_code, course_name, faculty, is_active)
values
('DEMO-SI101','Pengantar Sistem Informasi','Fakultas Sains dan Teknologi',true),
('DEMO-SI202','Analisis dan Perancangan Sistem','Fakultas Sains dan Teknologi',true),
('DEMO-UT102','Literasi Digital dan Pembelajaran Jarak Jauh','Lintas Fakultas',true),
('DEMO-STAT103','Statistika Dasar','Fakultas Sains dan Teknologi',true)
on conflict (course_code) do update
set course_name = excluded.course_name, faculty = excluded.faculty, is_active = true;

insert into public.matching_preferences (user_id, topic_tags, interests, study_times, preferred_programs, updated_at)
select id, topic_tags, interests, study_times, array['Sistem Informasi','Manajemen','Sains Data'], now()
from utconnect_demo_bots
on conflict (user_id) do update
set topic_tags=excluded.topic_tags, interests=excluded.interests,
    study_times=excluded.study_times, preferred_programs=excluded.preferred_programs, updated_at=now();

insert into public.matching_preferences (user_id, topic_tags, interests, study_times, preferred_programs, updated_at)
select user_id, array['Diskusi tugas','Pemrograman'], array['Belajar kelompok','Teknologi'],
       array['Malam','Akhir pekan'], array['Sistem Informasi'], now()
from private.app_user_roles where role='admin'
on conflict (user_id) do nothing;

insert into public.profile_courses (user_id, course_id)
select b.id, c.id
from utconnect_demo_bots b
join public.courses c on c.course_code = any(b.course_codes)
on conflict (user_id, course_id) do nothing;

insert into public.profile_courses (user_id, course_id)
select r.user_id, c.id
from private.app_user_roles r
join public.courses c on c.course_code in ('DEMO-SI101','DEMO-UT102')
where r.role='admin'
on conflict (user_id, course_id) do nothing;

-- Shared group workspaces: public/open for discovery and approval/private for access workflow.
insert into public.study_groups
  (id, created_by, name, description, course_id, mode, capacity, access_type,
   schedule_text, online_url, offline_area_label, is_archived, program, created_at, updated_at)
values
('d0000000-0000-4000-8000-000000000001','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f',
 'DEMO • Ruang Belajar Sistem Informasi',
 'Grup simulasi untuk mendemonstrasikan chat, pin pesan, agenda, target, tugas, dan polling.',
 (select id from public.courses where course_code='DEMO-SI101'),
 'online',30,'open','Senin dan Rabu • 19.30 WIB',null,null,false,'Sistem Informasi',now(),now()),
('d0000000-0000-4000-8000-000000000002','228d4d62-a223-4ead-92cc-d3480101c1de',
 'DEMO • Persiapan Ujian Bersama',
 'Grup simulasi dengan alur permintaan bergabung dan persetujuan admin.',
 (select id from public.courses where course_code='DEMO-UT102'),
 'online',20,'approval','Sabtu • 09.00 WIB',null,null,false,'Sistem Informasi',now(),now()),
('d0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000011',
 'DEMO • Komunitas Diskusi Privat',
 'Grup privat sintetis untuk memperagakan undangan grup.',
 (select id from public.courses where course_code='DEMO-SI202'),
 'online',15,'private','Minggu • 20.00 WIB',null,null,false,'Sistem Informasi',now(),now())
on conflict (id) do update
set name=excluded.name, description=excluded.description, course_id=excluded.course_id,
    mode=excluded.mode, capacity=excluded.capacity, access_type=excluded.access_type,
    schedule_text=excluded.schedule_text, program=excluded.program, is_archived=false, updated_at=now();

insert into public.group_members (group_id, user_id, role, status, joined_at, created_at, updated_at)
select g.group_id, g.user_id, g.role, g.status, now(), now(), now()
from (
  select 'd0000000-0000-4000-8000-000000000001'::uuid as group_id, user_id, 'admin'::public.group_member_role as role, 'active'::public.group_member_status as status
  from private.app_user_roles where role='admin'
  union all
  select 'd0000000-0000-4000-8000-000000000001'::uuid, id, 'member'::public.group_member_role, 'active'::public.group_member_status from utconnect_demo_bots
  union all
  select 'd0000000-0000-4000-8000-000000000002'::uuid, user_id, 'admin'::public.group_member_role, 'active'::public.group_member_status from private.app_user_roles where role='admin'
  union all
  select 'd0000000-0000-4000-8000-000000000002'::uuid, id, 'member'::public.group_member_role, 'active'::public.group_member_status from utconnect_demo_bots where id in (
    'b0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000006',
    'b0000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000008')
  union all
  select 'd0000000-0000-4000-8000-000000000002'::uuid, 'b0000000-0000-4000-8000-000000000012'::uuid, 'member'::public.group_member_role, 'pending'::public.group_member_status
  union all
  select 'd0000000-0000-4000-8000-000000000003'::uuid, 'b0000000-0000-4000-8000-000000000011'::uuid, 'admin'::public.group_member_role, 'active'::public.group_member_status
) g
on conflict (group_id,user_id) do update
set role=excluded.role, status=excluded.status, updated_at=now();

insert into public.group_messages (id, group_id, sender_id, body, pinned_at, pinned_by, created_at)
values
('e0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','Halo semua! Kita mulai diskusi materi Sistem Informasi di sini ya.',now(),'4cbf0d2b-8c73-49f0-8939-c44eb32fd58f',now()-interval '3 hours'),
('e0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002','Aku sudah rangkum materi pertemuan minggu ini. Ada yang mau bahas ERD?',null,null,now()-interval '2 hours 40 minutes'),
('e0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000003','Boleh! Aku juga punya contoh studi kasus sederhana.',null,null,now()-interval '2 hours 20 minutes'),
('e0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000004','Jangan lupa cek agenda dan polling jadwal belajar ya.',null,null,now()-interval '2 hours'),
('e0000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000005','Aku pilih Sabtu pagi untuk sesi latihan soal.',null,null,now()-interval '90 minutes'),
('e0000000-0000-4000-8000-000000000006','d0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000006','Siap, nanti aku siapkan ringkasan statistik.',null,null,now()-interval '60 minutes')
on conflict (id) do update
set body=excluded.body, pinned_at=excluded.pinned_at, pinned_by=excluded.pinned_by;

insert into public.group_agenda_items
  (id, group_id, created_by, item_type, title, details, due_at, poll_options, created_at, updated_at)
values
('f0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f','schedule','Sesi belajar bareng','Pembahasan pengantar sistem informasi dan latihan soal.',now()+interval '1 day',null,now(),now()),
('f0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f','target','Target pekan ini','Selesaikan modul 1 dan 2 serta diskusikan studi kasus.',now()+interval '3 days',null,now(),now()),
('f0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f','task','Latihan ERD','Buat ERD sederhana untuk sistem perpustakaan.',now()+interval '2 days',null,now(),now()),
('f0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000001','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f','poll','Pilih jadwal diskusi','Kapan waktu terbaik untuk diskusi berikutnya?',now()+interval '1 day','["Rabu 19.30","Kamis 20.00","Sabtu 09.00"]'::jsonb,now(),now()),
('f0000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000001','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f','note','Catatan kelompok','Gunakan forum untuk pertanyaan yang butuh jawaban lebih panjang.',null,null,now(),now())
on conflict (id) do update
set title=excluded.title, details=excluded.details, due_at=excluded.due_at,
    poll_options=excluded.poll_options, updated_at=now();

insert into public.group_agenda_votes (agenda_item_id, user_id, selected_option, created_at, updated_at)
values
('f0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000001','Rabu 19.30',now(),now()),
('f0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000002','Kamis 20.00',now(),now()),
('f0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000003','Rabu 19.30',now(),now())
on conflict (agenda_item_id,user_id) do update
set selected_option=excluded.selected_option, updated_at=now();

insert into public.group_invites (id, group_id, invited_user_id, invited_by, accepted_at, created_at)
values
('f1000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000003','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f','b0000000-0000-4000-8000-000000000011',null,now())
on conflict (id) do update set accepted_at=excluded.accepted_at;

insert into public.forum_posts
  (id, author_id, course_id, post_type, title, body, program, created_at, updated_at)
values
('a1000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001',(select id from public.courses where course_code='DEMO-SI101'),'need_help','Butuh teman diskusi ERD','Aku sedang belajar membuat ERD untuk sistem perpustakaan. Ada yang bisa berbagi contoh relasi one-to-many?','Sistem Informasi',now()-interval '2 hours',now()-interval '2 hours'),
('a1000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002',(select id from public.courses where course_code='DEMO-SI202'),'can_help','Bisa bantu dasar pemrograman','Aku siap bantu teman yang sedang belajar logika pemrograman dan dasar JavaScript.','Sistem Informasi',now()-interval '5 hours',now()-interval '5 hours'),
('a1000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000005',(select id from public.courses where course_code='DEMO-UT102'),'discussion','Tips konsisten kuliah jarak jauh','Apa cara kalian membagi waktu antara pekerjaan, kuliah, dan kegiatan harian? Yuk berbagi tips yang realistis.','Pendidikan Bahasa Inggris',now()-interval '1 day',now()-interval '1 day'),
('a1000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000009',(select id from public.courses where course_code='DEMO-STAT103'),'discussion','Belajar statistika bersama','Mari latihan membaca mean, median, modus, dan interpretasi data sederhana.','Pendidikan Matematika',now()-interval '30 hours',now()-interval '30 hours')
on conflict (id) do update
set title=excluded.title, body=excluded.body, updated_at=now();

insert into public.forum_comments (id, post_id, author_id, body, created_at)
values
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002','Untuk relasi one-to-many, satu kategori bisa memiliki banyak buku. Letakkan foreign key pada tabel buku.',now()-interval '100 minutes'),
('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000003','Setuju. Coba gambar entitas Anggota, Peminjaman, dan Buku supaya alurnya terlihat.',now()-interval '80 minutes'),
('a2000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000004','Aku tertarik ikut sesi belajar JavaScript. Terima kasih sudah menawarkan bantuan.',now()-interval '45 minutes'),
('a2000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000006','Aku biasanya pakai blok waktu 30 menit dan target kecil supaya konsisten.',now()-interval '35 minutes'),
('a2000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000008','Boleh mulai dari contoh data kecil lalu hitung manual sebelum memakai spreadsheet.',now()-interval '20 minutes')
on conflict (id) do update set body=excluded.body;

insert into public.information_posts
  (id, author_id, category, audience, title, body, source_url, is_published, published_at, created_at, updated_at)
values
('a3000000-0000-4000-8000-000000000001','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f','competition','verified_students','DEMO • Agenda Kompetisi Mahasiswa','Contoh informasi lomba untuk demonstrasi feed: cek syarat peserta, jadwal pendaftaran, ketentuan karya, dan tenggat pengumpulan sebelum mendaftar.','https://www.ut.ac.id/',true,now(),now(),now()),
('a3000000-0000-4000-8000-000000000002','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f','seminar','public','DEMO • Seminar Literasi Digital','Contoh pengumuman seminar: sesi berbagi tentang pembelajaran jarak jauh, keamanan akun, dan produktivitas belajar. Informasi ini adalah konten simulasi.','https://www.ut.ac.id/',true,now(),now(),now()),
('a3000000-0000-4000-8000-000000000003','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f','academic','verified_students','DEMO • Pengingat Kalender Akademik','Contoh pengingat akademik untuk memperagakan kategori, filter, dan detail informasi. Selalu cocokkan tanggal resmi melalui kanal UT.','https://www.ut.ac.id/',true,now(),now(),now())
on conflict (id) do update
set category=excluded.category, audience=excluded.audience, title=excluded.title,
    body=excluded.body, source_url=excluded.source_url, is_published=true,
    published_at=now(), updated_at=now();

-- Three connection states per presenter: accepted chat, incoming request, and outgoing request.
insert into public.connections (id,initiator_id,recipient_id,status,created_at,updated_at) values
('c0000000-0000-4000-8000-000000000001','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f','b0000000-0000-4000-8000-000000000001','accepted',now()-interval '2 days',now()),
('c0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f','pending',now()-interval '1 hour',now()),
('c0000000-0000-4000-8000-000000000003','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f','b0000000-0000-4000-8000-000000000003','pending',now()-interval '30 minutes',now()),
('c0000000-0000-4000-8000-000000000004','228d4d62-a223-4ead-92cc-d3480101c1de','b0000000-0000-4000-8000-000000000005','accepted',now()-interval '2 days',now()),
('c0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000006','228d4d62-a223-4ead-92cc-d3480101c1de','pending',now()-interval '2 hours',now()),
('c0000000-0000-4000-8000-000000000006','228d4d62-a223-4ead-92cc-d3480101c1de','b0000000-0000-4000-8000-000000000007','pending',now()-interval '50 minutes',now()),
('c0000000-0000-4000-8000-000000000007','cd3e82a5-8d6a-4e56-9400-c0d6423c0ab4','b0000000-0000-4000-8000-000000000009','accepted',now()-interval '2 days',now()),
('c0000000-0000-4000-8000-000000000008','b0000000-0000-4000-8000-000000000010','cd3e82a5-8d6a-4e56-9400-c0d6423c0ab4','pending',now()-interval '3 hours',now()),
('c0000000-0000-4000-8000-000000000009','cd3e82a5-8d6a-4e56-9400-c0d6423c0ab4','b0000000-0000-4000-8000-000000000011','pending',now()-interval '25 minutes',now())
on conflict (id) do update set initiator_id=excluded.initiator_id,recipient_id=excluded.recipient_id,status=excluded.status,updated_at=now();

insert into public.direct_messages (id, connection_id, sender_id, body, created_at, read_at)
values
('c1000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','Halo! Terima kasih sudah terhubung. Mau belajar bareng minggu ini?',now()-interval '70 minutes',now()-interval '60 minutes'),
('c1000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000001','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f','Boleh, kita bahas materi Sistem Informasi.',now()-interval '55 minutes',now()-interval '50 minutes'),
('c1000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','Aku siapkan beberapa contoh soal untuk diskusi.',now()-interval '40 minutes',null),
('c1000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000005','Hai! Aku tertarik bertukar catatan kuliah.',now()-interval '65 minutes',null),
('c1000000-0000-4000-8000-000000000005','c0000000-0000-4000-8000-000000000004','228d4d62-a223-4ead-92cc-d3480101c1de','Siap, kita bisa mulai dari materi minggu ini.',now()-interval '45 minutes',null),
('c1000000-0000-4000-8000-000000000006','c0000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000009','Aku bisa bantu latihan statistika dasar. Mau mulai dari mean atau median?',now()-interval '35 minutes',null)
on conflict (id) do update set body=excluded.body, read_at=excluded.read_at;

insert into public.notifications (id,user_id,notification_type,title,body,reference_id,read_at,created_at)
values
('a4000000-0000-4000-8000-000000000001','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f','connection_request','Permintaan koneksi baru','Bot Farhan ingin terhubung untuk belajar bersama.','c0000000-0000-4000-8000-000000000002',null,now()-interval '1 hour'),
('a4000000-0000-4000-8000-000000000002','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f','direct_message','Pesan baru dari Bot Nabila','Aku siapkan beberapa contoh soal untuk diskusi.','c0000000-0000-4000-8000-000000000001',null,now()-interval '40 minutes'),
('a4000000-0000-4000-8000-000000000003','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f','forum_comment','Komentar baru di diskusi','Bot Citra membalas diskusi ERD kamu.','a1000000-0000-4000-8000-000000000001',now(),now()-interval '30 minutes'),
('a4000000-0000-4000-8000-000000000004','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f','group_join_request','Permintaan bergabung ke grup','Bot Reza mengajukan permintaan bergabung ke Persiapan Ujian Bersama.','d0000000-0000-4000-8000-000000000002',null,now()-interval '20 minutes'),
('a4000000-0000-4000-8000-000000000005','4cbf0d2b-8c73-49f0-8939-c44eb32fd58f','group_invite','Undangan grup privat','Bot Siti mengundangmu ke Komunitas Diskusi Privat.','d0000000-0000-4000-8000-000000000003',null,now()-interval '10 minutes'),
('a4000000-0000-4000-8000-000000000006','228d4d62-a223-4ead-92cc-d3480101c1de','connection_request','Permintaan koneksi baru','Bot Dimas ingin terhubung untuk belajar bersama.','c0000000-0000-4000-8000-000000000005',null,now()-interval '2 hours'),
('a4000000-0000-4000-8000-000000000007','228d4d62-a223-4ead-92cc-d3480101c1de','direct_message','Pesan baru dari Bot Salma','Hai! Aku tertarik bertukar catatan kuliah.','c0000000-0000-4000-8000-000000000004',null,now()-interval '65 minutes'),
('a4000000-0000-4000-8000-000000000008','cd3e82a5-8d6a-4e56-9400-c0d6423c0ab4','connection_request','Permintaan koneksi baru','Bot Fajar ingin terhubung untuk belajar bersama.','c0000000-0000-4000-8000-000000000008',null,now()-interval '3 hours'),
('a4000000-0000-4000-8000-000000000009','cd3e82a5-8d6a-4e56-9400-c0d6423c0ab4','direct_message','Pesan baru dari Bot Hana','Aku bisa bantu latihan statistika dasar.','c0000000-0000-4000-8000-000000000007',null,now()-interval '35 minutes')
on conflict (id) do update
set title=excluded.title, body=excluded.body, reference_id=excluded.reference_id,
    read_at=excluded.read_at;

commit;
