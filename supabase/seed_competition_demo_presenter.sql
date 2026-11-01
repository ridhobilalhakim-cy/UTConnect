-- UTConnect competition demo data for the active production presenter account.
-- Idempotent, staging-only seed. Bot Auth users have random undisclosed passwords and are not login accounts.
begin;

create temp table utconnect_presenter_bots (
  id uuid primary key,
  email text not null,
  full_name text not null,
  faculty text not null,
  program text not null,
  semester smallint not null,
  offset_m double precision not null,
  angle_deg double precision not null,
  topic_tags text[] not null,
  interests text[] not null,
  study_times text[] not null,
  course_codes text[] not null
) on commit drop;

insert into utconnect_presenter_bots values
('b1000000-0000-4000-8000-000000000001','bot.presenter.01@demo.utconnect.test','BOT DEMO · Nabila Putri','Fakultas Sains dan Teknologi','Sistem Informasi · BOT DEMO',3,280,25,array['UI/UX','Basis Data'],array['Desain aplikasi','Membaca'],array['Malam','Akhir pekan'],array['DEMO-SI101','DEMO-UT102']),
('b1000000-0000-4000-8000-000000000002','bot.presenter.02@demo.utconnect.test','BOT DEMO · Farhan Akbar','Fakultas Sains dan Teknologi','Sistem Informasi · BOT DEMO',4,620,90,array['Pemrograman','Analisis Sistem'],array['Web development','Teknologi'],array['Pagi','Malam'],array['DEMO-SI101','DEMO-SI202']),
('b1000000-0000-4000-8000-000000000003','bot.presenter.03@demo.utconnect.test','BOT DEMO · Citra Maharani','Fakultas Ekonomi dan Bisnis','Manajemen · BOT DEMO',5,1050,160,array['Manajemen','Kewirausahaan'],array['Bisnis digital','Membaca'],array['Sore','Akhir pekan'],array['DEMO-UT102','DEMO-STAT103']),
('b1000000-0000-4000-8000-000000000004','bot.presenter.04@demo.utconnect.test','BOT DEMO · Rafi Ramadhan','Fakultas Sains dan Teknologi','Sains Data · BOT DEMO',2,1480,230,array['Jaringan','Pemrograman'],array['Keamanan digital','Game'],array['Malam'],array['DEMO-SI202','DEMO-STAT103']),
('b1000000-0000-4000-8000-000000000005','bot.presenter.05@demo.utconnect.test','BOT DEMO · Salma Zahra','Fakultas Keguruan dan Ilmu Pendidikan','Pendidikan Bahasa Inggris · BOT DEMO',6,2040,40,array['Bahasa Inggris','Literasi'],array['Menulis','Film edukasi'],array['Pagi','Sore'],array['DEMO-UT102']),
('b1000000-0000-4000-8000-000000000006','bot.presenter.06@demo.utconnect.test','BOT DEMO · Dimas Pratama','Fakultas Sains dan Teknologi','Sistem Informasi · BOT DEMO',3,2580,300,array['Data','Statistika'],array['Analisis data','Olahraga'],array['Malam'],array['DEMO-STAT103','DEMO-SI101']);

-- Six synthetic Auth identities. Their credentials are random hashes, not sign-in accounts.
insert into auth.users
(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
select b.id,'authenticated','authenticated',b.email,
extensions.crypt(gen_random_uuid()::text,extensions.gen_salt('bf')),now(),
jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
jsonb_build_object('full_name',b.full_name,'utconnect_demo_bot',true,'demo_only',true),now(),now(),false,false
from utconnect_presenter_bots b
on conflict (id) do update set email=excluded.email,email_confirmed_at=excluded.email_confirmed_at,
raw_user_meta_data=excluded.raw_user_meta_data,updated_at=now();

insert into public.profiles
(id,full_name,nim_digest,faculty,program,semester,verification_status,bio,created_at,updated_at)
select b.id,b.full_name,md5('UTCONNECT-PRESENTER-DEMO-NIM:'||b.id::text)||md5('UTCONNECT-PRESENTER-DEMO:'||b.email),
b.faculty,b.program,b.semester,'verified'::public.student_verification_status,
'AKUN BOT DEMO SINTETIS UT CONNECT. Bukan mahasiswa sungguhan. Konten dan interaksi hanya untuk demonstrasi.',
now(),now()
from utconnect_presenter_bots b
on conflict (id) do update set full_name=excluded.full_name,faculty=excluded.faculty,program=excluded.program,
semester=excluded.semester,verification_status='verified'::public.student_verification_status,
bio=excluded.bio,updated_at=now();

-- Synthetic map positions are offset from the presenter's already-consented map location.
insert into public.user_locations(user_id,location,show_in_radar,consented_at,updated_at)
select b.id,extensions.st_project(home.location,b.offset_m,radians(b.angle_deg)),true,now(),now()
from utconnect_presenter_bots b
join public.user_locations home on home.user_id='a5db5654-4215-4f1a-ade6-478227e97e1b'::uuid
on conflict (user_id) do update set location=excluded.location,show_in_radar=true,
consented_at=excluded.consented_at,updated_at=now();

-- Add each bot's study preferences and courses.
insert into public.matching_preferences(user_id,topic_tags,interests,study_times,preferred_programs,updated_at)
select id,topic_tags,interests,study_times,array[]::text[],now()
from utconnect_presenter_bots
on conflict (user_id) do update set topic_tags=excluded.topic_tags,interests=excluded.interests,
study_times=excluded.study_times,preferred_programs=excluded.preferred_programs,updated_at=now();

-- Give the presenter a default row only when they have not saved preferences already.
insert into public.matching_preferences(user_id,topic_tags,interests,study_times,preferred_programs,updated_at)
values ('a5db5654-4215-4f1a-ade6-478227e97e1b'::uuid,array[]::text[],array[]::text[],array[]::text[],array[]::text[],now())
on conflict (user_id) do nothing;

insert into public.profile_courses(user_id,course_id)
select b.id,c.id from utconnect_presenter_bots b
join public.courses c on c.course_code=any(b.course_codes)
on conflict(user_id,course_id) do nothing;

-- Demo connections for the logged-in presenter: three accepted chat rooms, incoming and outgoing requests.
insert into public.connections(id,initiator_id,recipient_id,status,created_at,updated_at) values
('c2000000-0000-4000-8000-000000000001','a5db5654-4215-4f1a-ade6-478227e97e1b','b1000000-0000-4000-8000-000000000001','accepted',now()-interval '2 days',now()),
('c2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','a5db5654-4215-4f1a-ade6-478227e97e1b','accepted',now()-interval '36 hours',now()),
('c2000000-0000-4000-8000-000000000003','a5db5654-4215-4f1a-ade6-478227e97e1b','b1000000-0000-4000-8000-000000000003','accepted',now()-interval '1 day',now()),
('c2000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000004','a5db5654-4215-4f1a-ade6-478227e97e1b','pending',now()-interval '35 minutes',now()),
('c2000000-0000-4000-8000-000000000005','a5db5654-4215-4f1a-ade6-478227e97e1b','b1000000-0000-4000-8000-000000000005','pending',now()-interval '20 minutes',now())
on conflict (id) do update set initiator_id=excluded.initiator_id,recipient_id=excluded.recipient_id,
status=excluded.status,updated_at=now();

insert into public.direct_messages(id,connection_id,sender_id,body,created_at,read_at) values
('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','Halo! Aku Nabila, tertarik belajar UI/UX dan basis data. Kita diskusi bareng yuk.',now()-interval '95 minutes',now()-interval '85 minutes'),
('c3000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','a5db5654-4215-4f1a-ade6-478227e97e1b','Siap, aku juga sedang mendalami sistem informasi.',now()-interval '80 minutes',now()-interval '75 minutes'),
('c3000000-0000-4000-8000-000000000003','c2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','Aku sudah siapkan catatan singkat untuk bahan diskusi.',now()-interval '60 minutes',null),
('c3000000-0000-4000-8000-000000000004','c2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','Hai! Aku punya contoh latihan analisis sistem. Mau kita bahas?',now()-interval '70 minutes',null),
('c3000000-0000-4000-8000-000000000005','c2000000-0000-4000-8000-000000000002','a5db5654-4215-4f1a-ade6-478227e97e1b','Boleh, kirimkan contoh kasusnya ya.',now()-interval '50 minutes',null),
('c3000000-0000-4000-8000-000000000006','c2000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000003','Aku bisa berbagi tips menyusun jadwal belajar dan mengelola proyek kelompok.',now()-interval '40 minutes',null)
on conflict (id) do update set body=excluded.body,read_at=excluded.read_at;

-- A richer set of group scenarios. All memberships are verified synthetic participants or the current presenter.
insert into public.study_groups(id,created_by,name,description,course_id,mode,capacity,access_type,schedule_text,online_url,offline_area_label,is_archived,program,created_at,updated_at)
values
('d2000000-0000-4000-8000-000000000001','a5db5654-4215-4f1a-ade6-478227e97e1b','DEMO • Ruang Belajar Interaktif','Grup terbuka aktif dengan obrolan, materi, agenda, dan target belajar bersama.',(select id from public.courses where course_code='DEMO-SI101'),'online',20,'open','Senin & Rabu • 19.30 WIB',null,null,false,'Sistem Informasi',now(),now()),
('d2000000-0000-4000-8000-000000000002','a5db5654-4215-4f1a-ade6-478227e97e1b','DEMO • Kelas Diskusi Penuh','Simulasi grup yang sudah mencapai kapasitas maksimal.',(select id from public.courses where course_code='DEMO-SI202'),'online',4,'open','Selasa • 20.00 WIB',null,null,false,'Sistem Informasi',now(),now()),
('d2000000-0000-4000-8000-000000000003','a5db5654-4215-4f1a-ade6-478227e97e1b','DEMO • Persetujuan Admin','Grup dengan satu permohonan anggota yang menunggu keputusan admin.',(select id from public.courses where course_code='DEMO-UT102'),'online',12,'approval','Sabtu • 09.00 WIB',null,null,false,'Sistem Informasi',now(),now()),
('d2000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000001','DEMO • Gabung dengan Persetujuan','Simulasi grup yang memerlukan persetujuan pengelola sebelum anggota aktif.',(select id from public.courses where course_code='DEMO-STAT103'),'online',15,'approval','Kamis • 19.00 WIB',null,null,false,'Sains Data',now(),now()),
('d2000000-0000-4000-8000-000000000005','b1000000-0000-4000-8000-000000000002','DEMO • Komunitas Privat','Grup undangan khusus untuk memperagakan undangan dan penerimaan anggota.',(select id from public.courses where course_code='DEMO-SI101'),'online',10,'private','Minggu • 20.00 WIB',null,null,false,'Sistem Informasi',now(),now())
on conflict(id) do update set created_by=excluded.created_by,name=excluded.name,description=excluded.description,
course_id=excluded.course_id,mode=excluded.mode,capacity=excluded.capacity,access_type=excluded.access_type,
schedule_text=excluded.schedule_text,program=excluded.program,is_archived=false,updated_at=now();

-- Also populate the existing "Belajar Algoritma" group that the presenter opened in the screenshot.
insert into public.group_members(group_id,user_id,role,status,joined_at,created_at,updated_at)
values
('cc3351a1-9244-418a-b1a8-095b1161af63','b1000000-0000-4000-8000-000000000001','member','active',now(),now(),now()),
('cc3351a1-9244-418a-b1a8-095b1161af63','b1000000-0000-4000-8000-000000000002','member','active',now(),now(),now()),
('cc3351a1-9244-418a-b1a8-095b1161af63','b1000000-0000-4000-8000-000000000003','member','active',now(),now(),now()),
('cc3351a1-9244-418a-b1a8-095b1161af63','b1000000-0000-4000-8000-000000000004','member','active',now(),now(),now()),
('cc3351a1-9244-418a-b1a8-095b1161af63','b1000000-0000-4000-8000-000000000005','member','active',now(),now(),now()),
('d2000000-0000-4000-8000-000000000001','a5db5654-4215-4f1a-ade6-478227e97e1b','admin','active',now(),now(),now()),
('d2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','member','active',now(),now(),now()),
('d2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','member','active',now(),now(),now()),
('d2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000003','member','active',now(),now(),now()),
('d2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000004','member','active',now(),now(),now()),
('d2000000-0000-4000-8000-000000000002','a5db5654-4215-4f1a-ade6-478227e97e1b','admin','active',now(),now(),now()),
('d2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001','member','active',now(),now(),now()),
('d2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','member','active',now(),now(),now()),
('d2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000003','member','active',now(),now(),now()),
('d2000000-0000-4000-8000-000000000003','a5db5654-4215-4f1a-ade6-478227e97e1b','admin','active',now(),now(),now()),
('d2000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000004','member','active',now(),now(),now()),
('d2000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000005','member','active',now(),now(),now()),
('d2000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000006','member','pending',null,now(),now()),
('d2000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000001','admin','active',now(),now(),now()),
('d2000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000002','member','active',now(),now(),now()),
('d2000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000003','member','active',now(),now(),now()),
('d2000000-0000-4000-8000-000000000005','b1000000-0000-4000-8000-000000000002','admin','active',now(),now(),now())
on conflict(group_id,user_id) do update set role=excluded.role,status=excluded.status,
joined_at=excluded.joined_at,updated_at=now();

insert into public.group_invites(id,group_id,invited_user_id,invited_by,accepted_at,created_at)
values ('f2000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000005','a5db5654-4215-4f1a-ade6-478227e97e1b','b1000000-0000-4000-8000-000000000002',null,now())
on conflict(id) do update set invited_user_id=excluded.invited_user_id,invited_by=excluded.invited_by,accepted_at=null;

-- Seed lively chat history into the exact group shown in the user's screenshot.
insert into public.group_messages(id,group_id,sender_id,body,pinned_at,pinned_by,created_at)
values
('e2000000-0000-4000-8000-000000000001','cc3351a1-9244-418a-b1a8-095b1161af63','b1000000-0000-4000-8000-000000000001','Halo semua! Ada yang sudah mulai latihan algoritma minggu ini?',now(),'e292fd3a-ca99-440e-9795-efa6e0ee9151',now()-interval '3 hours'),
('e2000000-0000-4000-8000-000000000002','cc3351a1-9244-418a-b1a8-095b1161af63','b1000000-0000-4000-8000-000000000002','Aku sudah coba latihan percabangan. Ternyata lebih mudah kalau dibuat flowchart.',null,null,now()-interval '160 minutes'),
('e2000000-0000-4000-8000-000000000003','cc3351a1-9244-418a-b1a8-095b1161af63','b1000000-0000-4000-8000-000000000003','Setuju! Aku bisa bantu bahas contoh perulangan dan array.',null,null,now()-interval '135 minutes'),
('e2000000-0000-4000-8000-000000000004','cc3351a1-9244-418a-b1a8-095b1161af63','b1000000-0000-4000-8000-000000000004','Boleh kita jadwalkan sesi belajar bareng malam ini?',null,null,now()-interval '110 minutes'),
('e2000000-0000-4000-8000-000000000005','cc3351a1-9244-418a-b1a8-095b1161af63','b1000000-0000-4000-8000-000000000005','Aku ikut. Nanti aku siapkan catatan singkat untuk semuanya.',null,null,now()-interval '85 minutes'),
('e2000000-0000-4000-8000-000000000006','cc3351a1-9244-418a-b1a8-095b1161af63','a5db5654-4215-4f1a-ade6-478227e97e1b','Sip, kita bahas bertahap supaya semua paham.',null,null,now()-interval '60 minutes'),
('e2000000-0000-4000-8000-000000000007','d2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','Selamat datang! Tulis target belajar kalian di agenda ya.',null,null,now()-interval '45 minutes'),
('e2000000-0000-4000-8000-000000000008','d2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','Aku siap ikut sesi diskusi dan bantu review tugas.',null,null,now()-interval '30 minutes')
on conflict(id) do update set body=excluded.body,pinned_at=excluded.pinned_at,pinned_by=excluded.pinned_by;

insert into public.group_agenda_items(id,group_id,created_by,item_type,title,details,due_at,poll_options,created_at,updated_at)
values
('f2000000-0000-4000-8000-000000000010','cc3351a1-9244-418a-b1a8-095b1161af63','a5db5654-4215-4f1a-ade6-478227e97e1b','schedule','Sesi algoritma bersama','Diskusi flowchart, percabangan, dan perulangan.',now()+interval '1 day',null,now(),now()),
('f2000000-0000-4000-8000-000000000011','cc3351a1-9244-418a-b1a8-095b1161af63','a5db5654-4215-4f1a-ade6-478227e97e1b','task','Latihan array dan perulangan','Kerjakan latihan dasar sebelum pertemuan berikutnya.',now()+interval '2 days',null,now(),now()),
('f2000000-0000-4000-8000-000000000012','cc3351a1-9244-418a-b1a8-095b1161af63','a5db5654-4215-4f1a-ade6-478227e97e1b','poll','Pilih waktu belajar berikutnya','Pilih waktu yang paling cocok untuk semua anggota.',now()+interval '1 day','["Rabu 19.30","Kamis 20.00","Sabtu 09.00"]'::jsonb,now(),now()),
('f2000000-0000-4000-8000-000000000013','d2000000-0000-4000-8000-000000000001','a5db5654-4215-4f1a-ade6-478227e97e1b','target','Target pekan ini','Menyelesaikan dua modul dan berdiskusi bersama.',now()+interval '4 days',null,now(),now())
on conflict(id) do update set title=excluded.title,details=excluded.details,due_at=excluded.due_at,
poll_options=excluded.poll_options,updated_at=now();

insert into public.group_agenda_votes(agenda_item_id,user_id,selected_option,created_at,updated_at)
values
('f2000000-0000-4000-8000-000000000012','b1000000-0000-4000-8000-000000000001','Rabu 19.30',now(),now()),
('f2000000-0000-4000-8000-000000000012','b1000000-0000-4000-8000-000000000002','Kamis 20.00',now(),now()),
('f2000000-0000-4000-8000-000000000012','b1000000-0000-4000-8000-000000000003','Rabu 19.30',now(),now())
on conflict(agenda_item_id,user_id) do update set selected_option=excluded.selected_option,updated_at=now();

-- Keep the presenter inbox populated with connection, message, group request, and private invite events.
insert into public.notifications(id,user_id,notification_type,title,body,reference_id,read_at,created_at)
values
('a5000000-0000-4000-8000-000000000001','a5db5654-4215-4f1a-ade6-478227e97e1b','connection_request','Permintaan koneksi baru','BOT DEMO · Rafi ingin terhubung untuk belajar bersama.','c2000000-0000-4000-8000-000000000004',null,now()-interval '35 minutes'),
('a5000000-0000-4000-8000-000000000002','a5db5654-4215-4f1a-ade6-478227e97e1b','direct_message','Pesan baru dari BOT DEMO · Nabila','Aku sudah siapkan catatan singkat untuk bahan diskusi.','c2000000-0000-4000-8000-000000000001',null,now()-interval '60 minutes'),
('a5000000-0000-4000-8000-000000000003','a5db5654-4215-4f1a-ade6-478227e97e1b','group_join_request','Permohonan bergabung ke grup','BOT DEMO · Dimas mengajukan permohonan bergabung ke DEMO • Persetujuan Admin.','d2000000-0000-4000-8000-000000000003',null,now()-interval '15 minutes'),
('a5000000-0000-4000-8000-000000000004','a5db5654-4215-4f1a-ade6-478227e97e1b','group_invite','Undangan grup privat','BOT DEMO · Farhan mengundangmu ke DEMO • Komunitas Privat.','d2000000-0000-4000-8000-000000000005',null,now()-interval '5 minutes')
on conflict(id) do update set title=excluded.title,body=excluded.body,reference_id=excluded.reference_id,read_at=excluded.read_at;

commit;