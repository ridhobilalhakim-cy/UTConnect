-- Use the official UT programme list when the course catalogue is not populated.
-- Retain course_id columns so legacy rows and future course-catalogue support remain compatible.

ALTER TABLE public.study_groups ADD COLUMN program text;
ALTER TABLE public.study_groups
  ADD CONSTRAINT study_groups_program_allowed_check
  CHECK (program IS NULL OR program = ANY(ARRAY[
  'Manajemen',
  'Ekonomi Pembangunan',
  'Ekonomi Syariah',
  'Akuntansi',
  'Akuntansi Keuangan Publik',
  'Pariwisata',
  'Kewirausahaan',
  'Ilmu Administrasi Publik',
  'Administrasi Bisnis',
  'Hukum',
  'Ilmu Pemerintahan',
  'Ilmu Komunikasi',
  'Perpustakaan dan Sains Informasi',
  'Sosiologi',
  'Sastra Inggris',
  'Perpajakan',
  'Pendidikan Bahasa dan Sastra Indonesia',
  'Pendidikan Bahasa Inggris',
  'Pendidikan Biologi',
  'Pendidikan Fisika',
  'Pendidikan Kimia',
  'Pendidikan Matematika',
  'Pendidikan Ekonomi',
  'Pendidikan Pancasila dan Kewarganegaraan',
  'Teknologi Pendidikan',
  'Pendidikan Guru Sekolah Dasar (PGSD)',
  'Pendidikan Guru Pendidikan Anak Usia Dini (PGPAUD)',
  'Pendidikan Agama Islam (PAI)',
  'Statistika',
  'Matematika',
  'Biologi',
  'Teknologi Pangan',
  'Agribisnis',
  'Perencanaan Wilayah dan Kota',
  'Sistem Informasi',
  'Sains Data'
]::text[]));

ALTER TABLE public.forum_posts ADD COLUMN program text;
ALTER TABLE public.forum_posts
  ADD CONSTRAINT forum_posts_program_allowed_check
  CHECK (program IS NULL OR program = ANY(ARRAY[
  'Manajemen',
  'Ekonomi Pembangunan',
  'Ekonomi Syariah',
  'Akuntansi',
  'Akuntansi Keuangan Publik',
  'Pariwisata',
  'Kewirausahaan',
  'Ilmu Administrasi Publik',
  'Administrasi Bisnis',
  'Hukum',
  'Ilmu Pemerintahan',
  'Ilmu Komunikasi',
  'Perpustakaan dan Sains Informasi',
  'Sosiologi',
  'Sastra Inggris',
  'Perpajakan',
  'Pendidikan Bahasa dan Sastra Indonesia',
  'Pendidikan Bahasa Inggris',
  'Pendidikan Biologi',
  'Pendidikan Fisika',
  'Pendidikan Kimia',
  'Pendidikan Matematika',
  'Pendidikan Ekonomi',
  'Pendidikan Pancasila dan Kewarganegaraan',
  'Teknologi Pendidikan',
  'Pendidikan Guru Sekolah Dasar (PGSD)',
  'Pendidikan Guru Pendidikan Anak Usia Dini (PGPAUD)',
  'Pendidikan Agama Islam (PAI)',
  'Statistika',
  'Matematika',
  'Biologi',
  'Teknologi Pangan',
  'Agribisnis',
  'Perencanaan Wilayah dan Kota',
  'Sistem Informasi',
  'Sains Data'
]::text[]));

ALTER TABLE public.matching_preferences
  ADD COLUMN preferred_programs text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.matching_preferences
  ADD CONSTRAINT matching_preferences_programs_allowed_check
  CHECK (
    cardinality(preferred_programs) <= 12
    AND preferred_programs <@ ARRAY[
  'Manajemen',
  'Ekonomi Pembangunan',
  'Ekonomi Syariah',
  'Akuntansi',
  'Akuntansi Keuangan Publik',
  'Pariwisata',
  'Kewirausahaan',
  'Ilmu Administrasi Publik',
  'Administrasi Bisnis',
  'Hukum',
  'Ilmu Pemerintahan',
  'Ilmu Komunikasi',
  'Perpustakaan dan Sains Informasi',
  'Sosiologi',
  'Sastra Inggris',
  'Perpajakan',
  'Pendidikan Bahasa dan Sastra Indonesia',
  'Pendidikan Bahasa Inggris',
  'Pendidikan Biologi',
  'Pendidikan Fisika',
  'Pendidikan Kimia',
  'Pendidikan Matematika',
  'Pendidikan Ekonomi',
  'Pendidikan Pancasila dan Kewarganegaraan',
  'Teknologi Pendidikan',
  'Pendidikan Guru Sekolah Dasar (PGSD)',
  'Pendidikan Guru Pendidikan Anak Usia Dini (PGPAUD)',
  'Pendidikan Agama Islam (PAI)',
  'Statistika',
  'Matematika',
  'Biologi',
  'Teknologi Pangan',
  'Agribisnis',
  'Perencanaan Wilayah dan Kota',
  'Sistem Informasi',
  'Sains Data'
]::text[]
  );
