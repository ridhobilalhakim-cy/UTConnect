// Official UT undergraduate study programmes (36 S1 programmes across four faculties).
// Source: https://www.ut.ac.id/program-studi/ and UT 2026/2027 curriculum catalogue.
export const UT_FACULTY_PROGRAMS = Object.freeze({
  "Fakultas Ekonomi dan Bisnis (FEB)": [
    "Manajemen",
    "Ekonomi Pembangunan",
    "Ekonomi Syariah",
    "Akuntansi",
    "Akuntansi Keuangan Publik",
    "Pariwisata",
    "Kewirausahaan",
  ],
  "Fakultas Hukum, Ilmu Sosial, dan Ilmu Politik (FHISIP)": [
    "Ilmu Administrasi Publik",
    "Administrasi Bisnis",
    "Hukum",
    "Ilmu Pemerintahan",
    "Ilmu Komunikasi",
    "Perpustakaan dan Sains Informasi",
    "Sosiologi",
    "Sastra Inggris",
    "Perpajakan",
  ],
  "Fakultas Keguruan dan Ilmu Pendidikan (FKIP)": [
    "Pendidikan Bahasa dan Sastra Indonesia",
    "Pendidikan Bahasa Inggris",
    "Pendidikan Biologi",
    "Pendidikan Fisika",
    "Pendidikan Kimia",
    "Pendidikan Matematika",
    "Pendidikan Ekonomi",
    "Pendidikan Pancasila dan Kewarganegaraan",
    "Teknologi Pendidikan",
    "Pendidikan Guru Sekolah Dasar (PGSD)",
    "Pendidikan Guru Pendidikan Anak Usia Dini (PGPAUD)",
    "Pendidikan Agama Islam (PAI)",
  ],
  "Fakultas Sains dan Teknologi (FST)": [
    "Statistika",
    "Matematika",
    "Biologi",
    "Teknologi Pangan",
    "Agribisnis",
    "Perencanaan Wilayah dan Kota",
    "Sistem Informasi",
    "Sains Data",
  ],
});

export const UT_FACULTIES = Object.freeze(Object.keys(UT_FACULTY_PROGRAMS));

const UT_FACULTY_ALIASES = Object.freeze({
  FEB: "Fakultas Ekonomi dan Bisnis (FEB)",
  FKIP: "Fakultas Keguruan dan Ilmu Pendidikan (FKIP)",
  FST: "Fakultas Sains dan Teknologi (FST)",
  FHISIP: "Fakultas Hukum, Ilmu Sosial, dan Ilmu Politik (FHISIP)",
  "FAKULTAS EKONOMI DAN BISNIS": "Fakultas Ekonomi dan Bisnis (FEB)",
  "FAKULTAS KEGURUAN DAN ILMU PENDIDIKAN": "Fakultas Keguruan dan Ilmu Pendidikan (FKIP)",
  "FAKULTAS SAINS DAN TEKNOLOGI": "Fakultas Sains dan Teknologi (FST)",
  "FAKULTAS HUKUM, ILMU SOSIAL, DAN ILMU POLITIK": "Fakultas Hukum, Ilmu Sosial, dan Ilmu Politik (FHISIP)",
});

export function resolveUTFaculty(value) {
  const raw = String(value || "").trim();
  if (UT_FACULTY_PROGRAMS[raw]) return raw;
  return UT_FACULTY_ALIASES[raw.toUpperCase()] || "";
}

export function isOfficialUTProgramme(faculty, program) {
  return Boolean(UT_FACULTY_PROGRAMS[resolveUTFaculty(faculty)]?.includes(program));
}

export function populateUTFacultyProgramSelects(facultySelect, programSelect, options = {}) {
  if (!facultySelect || !programSelect) return;
  const selectedFaculty = resolveUTFaculty(options.faculty);
  const selectedProgram = options.program || "";
  facultySelect.innerHTML = '<option value="">Pilih fakultas</option>' +
    UT_FACULTIES.map(name => `<option value="${name.replaceAll('"', '&quot;')}">${name}</option>`).join("");
  facultySelect.value = selectedFaculty;

  const updatePrograms = (preferred = "") => {
    const faculty = facultySelect.value;
    const programmes = UT_FACULTY_PROGRAMS[faculty] || [];
    programSelect.innerHTML = '<option value="">Pilih program studi</option>' +
      programmes.map(name => `<option value="${name.replaceAll('"', '&quot;')}">${name}</option>`).join("");
    programSelect.disabled = programmes.length === 0;
    programSelect.value = programmes.includes(preferred) ? preferred : "";
  };

  updatePrograms(selectedProgram);
  if (!facultySelect.dataset.utProgramBound) {
    facultySelect.addEventListener("change", () => updatePrograms(""));
    facultySelect.dataset.utProgramBound = "true";
  }
}
