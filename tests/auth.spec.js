import { test, expect } from '@playwright/test';

const SUPABASE_URL = 'https://hqyusbyndtlfypdbmatw.supabase.co';
const STORAGE_KEY = 'utconnect-hqyusbyndtlfypdbmatw-auth';
const USER = {
  id: 'a1d2c3e4-f5a6-47b8-9c01-234567890abc',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'student.e2e@example.test',
  email_confirmed_at: '2026-10-01T00:00:00.000Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Mahasiswa Uji' },
  identities: [],
  created_at: '2026-10-01T00:00:00.000Z',
};
const PROFILE = {
  id: USER.id,
  full_name: 'Mahasiswa Uji',
  faculty: 'Fakultas Sains dan Teknologi',
  program: 'Sistem Informasi',
  semester: 1,
  verification_status: 'pending',
};

function jsonResponse(body, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

async function mockSupabase(page, { isAdmin = false, informationPosts = [], verificationStatus = { profile_status: 'pending', latest_request: null }, verificationQueue = [] } = {}) {
  const state = { loginCalls: 0, recoveryCalls: 0, passwordUpdates: 0, logoutCalls: 0, informationPosts: [...informationPosts], informationCreateCalls: 0, verificationStatus: structuredClone(verificationStatus), verificationQueue: [...verificationQueue], verificationUploadCalls: 0, verificationSubmitCalls: 0, verificationReviewCalls: [] };
  for (const pattern of [
    /^https:\/\/fonts\.googleapis\.com\//,
    /^https:\/\/fonts\.gstatic\.com\//,
    /^https:\/\/unpkg\.com\//,
    /^https:\/\/[a-z]\.tile\.openstreetmap\.org\//,
  ]) {
    await page.route(pattern, route => route.abort());
  }
  await page.route(`${SUPABASE_URL}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path.endsWith('/auth/v1/settings')) {
      return route.fulfill(jsonResponse({ external: { google: false }, disable_signup: false, mailer_autoconfirm: true }));
    }
    if (path.endsWith('/auth/v1/token') && url.searchParams.get('grant_type') === 'password' && method === 'POST') {
      state.loginCalls += 1;
      return route.fulfill(jsonResponse({
        access_token: 'e2e-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'e2e-refresh-token',
        user: USER,
      }));
    }
    if (path.endsWith('/auth/v1/recover') && method === 'POST') {
      state.recoveryCalls += 1;
      return route.fulfill(jsonResponse({}));
    }
    if (path.endsWith('/auth/v1/user') && method === 'PUT') {
      state.passwordUpdates += 1;
      return route.fulfill(jsonResponse({ ...USER, updated_at: new Date().toISOString() }));
    }
    if (path.endsWith('/auth/v1/logout') && method === 'POST') {
      state.logoutCalls += 1;
      return route.fulfill({ status: 204, body: '' });
    }
    if (path.endsWith('/rest/v1/rpc/is_current_user_admin') && method === 'POST') {
      return route.fulfill(jsonResponse(isAdmin));
    }
    if (path.endsWith('/rest/v1/rpc/get_my_student_verification_status') && method === 'POST') {
      return route.fulfill(jsonResponse(state.verificationStatus));
    }
    if (path.endsWith('/rest/v1/rpc/admin_list_student_verification_queue') && method === 'POST') {
      return route.fulfill(jsonResponse(state.verificationQueue));
    }
    if (path.endsWith('/rest/v1/rpc/submit_student_verification') && method === 'POST') {
      const input = request.postDataJSON();
      state.verificationSubmitCalls += 1;
      state.verificationStatus = {
        profile_status: 'pending',
        latest_request: { id: 'verification-e2e-001', status: 'submitted', original_filename: input.p_original_filename, submitted_at: new Date().toISOString() },
      };
      return route.fulfill(jsonResponse({ success: true, request_id: 'verification-e2e-001', status: 'submitted' }));
    }
    if (path.endsWith('/rest/v1/rpc/admin_review_student_verification') && method === 'POST') {
      const input = request.postDataJSON();
      state.verificationReviewCalls.push(input);
      state.verificationQueue = state.verificationQueue.filter(item => item.request_id !== input.p_request_id);
      return route.fulfill(jsonResponse({ success: true, decision: input.p_decision }));
    }
    if (path.includes('/storage/v1/object/student-verification-evidence/') && method === 'POST') {
      state.verificationUploadCalls += 1;
      return route.fulfill(jsonResponse({ Key: 'student-verification-evidence/e2e-student-001/evidence.pdf' }));
    }
    if (path.endsWith('/rest/v1/information_posts')) {
      if (method === 'GET') return route.fulfill(jsonResponse(state.informationPosts));
      if (method === 'POST') {
        const input = request.postDataJSON();
        const created = { id: 'info-e2e-001', author_id: USER.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...input };
        state.informationCreateCalls += 1;
        state.informationPosts.unshift(created);
        return route.fulfill(jsonResponse(created, 201));
      }
      if (method === 'PATCH') {
        const id = url.searchParams.get('id')?.replace(/^eq\./, '');
        const input = request.postDataJSON();
        const index = state.informationPosts.findIndex(item => item.id === id);
        if (index >= 0) state.informationPosts[index] = { ...state.informationPosts[index], ...input };
        return route.fulfill(jsonResponse(state.informationPosts[index] || {}, 200));
      }
      if (method === 'DELETE') {
        const id = url.searchParams.get('id')?.replace(/^eq\./, '');
        state.informationPosts = state.informationPosts.filter(item => item.id !== id);
        return route.fulfill(jsonResponse({ id }, 200));
      }
    }
    if (path.includes('/storage/v1/object/student-verification-evidence/') && method === 'DELETE') {
      return route.fulfill(jsonResponse({}));
    }
    if (path.endsWith('/rest/v1/profiles') && method === 'GET') {
      return route.fulfill(jsonResponse([PROFILE]));
    }
    if (path.endsWith('/auth/v1/user') && method === 'GET') {
      return route.fulfill(jsonResponse(USER));
    }

    return route.fulfill(jsonResponse({}));
  });
  return state;
}

async function seedRecoverySession(page) {
  const session = {
    access_token: 'e2e-recovery-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'e2e-recovery-refresh-token',
    user: USER,
  };
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: session });
}

test('login and registration are separate views', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Selamat datang kembali' })).toBeVisible();
  await expect(page.locator('#registerView')).toBeHidden();

  await page.getByRole('button', { name: 'Daftar sekarang' }).click();
  await expect(page.getByRole('heading', { name: 'Buat akun UT Connect' })).toBeVisible();
  await expect(page.getByLabel('NIM')).toBeVisible();

  await page.getByRole('button', { name: 'Masuk', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Selamat datang kembali' })).toBeVisible();
});

test('guest cannot open the protected dashboard', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/app.html');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Selamat datang kembali' })).toBeVisible();
});

test('email login restores session and logout clears it', async ({ page }) => {
  const state = await mockSupabase(page);
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await expect(page).toHaveURL(/\/app\.html$/);
  await expect(page.locator('#topUserName')).toHaveText('Mahasiswa Uji');
  await expect.poll(() => state.loginCalls).toBe(1);

  await page.reload();
  await expect(page.locator('#topUserName')).toHaveText('Mahasiswa Uji');

  await page.getByRole('button', { name: 'Keluar' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Selamat datang kembali' })).toBeVisible();
  await expect.poll(() => state.logoutCalls).toBe(1);
});

test('forgot password sends a non-enumerating recovery request', async ({ page }) => {
  const state = await mockSupabase(page);
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.getByRole('button', { name: 'Lupa password?' }).click();

  await expect(page.locator('#alertBox')).toContainText('Jika akun ditemukan');
  await expect.poll(() => state.recoveryCalls).toBe(1);
});

test('password recovery validates confirmation and updates the password', async ({ page }) => {
  const state = await mockSupabase(page);
  await seedRecoverySession(page);
  await page.goto('/?mode=recovery');

  await expect(page.getByRole('heading', { name: 'Atur ulang password' })).toBeVisible();
  await page.locator('#newPassword').fill('PasswordBaru123!');
  await page.locator('#confirmNewPassword').fill('PasswordBerbeda123!');
  await page.getByRole('button', { name: 'Simpan password baru' }).click();
  await expect(page.locator('#alertBox')).toContainText('Konfirmasi password belum sama');
  expect(state.passwordUpdates).toBe(0);

  await page.locator('#confirmNewPassword').fill('PasswordBaru123!');
  await page.getByRole('button', { name: 'Simpan password baru' }).click();
  await expect(page).toHaveURL(/passwordUpdated=1/);
  await expect(page.locator('#alertBox')).toContainText('Password berhasil diperbarui');
  expect(state.passwordUpdates).toBe(1);
  expect(state.logoutCalls).toBe(1);
});

test('administrator can publish an Information UT post through Supabase', async ({ page }) => {
  const state = await mockSupabase(page, { isAdmin: true });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await expect(page).toHaveURL(/\/app\.html$/);
  await expect(page.locator('#topUserMeta')).toHaveText('Administrator UT Connect');
  await page.locator('[data-page="info"]').first().click();
  await expect(page.locator('#share-info')).toBeVisible();
  await page.locator('#share-info').click();

  await page.locator('#info-title-input').fill('Jadwal Webinar UT');
  await page.locator('#info-category-input').selectOption('seminar');
  await page.locator('#info-body-input').fill('Webinar terbuka untuk mahasiswa Universitas Terbuka.');
  await page.locator('#info-source-input').fill('https://ut.ac.id');
  await page.locator('#modal-confirm').click();

  await expect(page.locator('.info-card h3')).toHaveText('Jadwal Webinar UT');
  expect(state.informationCreateCalls).toBe(1);
  expect(state.informationPosts[0].is_published).toBe(true);

  await page.locator('[data-info-edit]').click();
  await page.locator('#info-title-input').fill('Jadwal Webinar UT 2026');
  await page.locator('#modal-confirm').click();
  await expect(page.locator('.info-card h3')).toHaveText('Jadwal Webinar UT 2026');

  await page.locator('[data-info-publish]').click();
  await expect(page.locator('.info-status')).toHaveText('Draft');
  expect(state.informationPosts[0].is_published).toBe(false);

  await page.locator('[data-info-publish]').click();
  await expect(page.locator('.info-status')).toHaveText('Dipublikasikan');
  expect(state.informationPosts[0].is_published).toBe(true);

  await page.locator('[data-info-delete]').click();
  await page.locator('#modal-confirm').click();
  await expect(page.locator('.info-empty')).toContainText('Belum ada informasi');
  expect(state.informationPosts).toHaveLength(0);
});

test('ordinary student can read public Information UT without admin controls', async ({ page }) => {
  const state = await mockSupabase(page, {
    informationPosts: [{
      id: 'info-public-001',
      author_id: 'another-user',
      category: 'academic',
      audience: 'public',
      title: 'Kalender Akademik',
      body: 'Informasi kalender akademik untuk mahasiswa.',
      source_url: null,
      is_published: true,
      published_at: '2026-10-01T00:00:00.000Z',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
    }],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('[data-page="info"]').first().click();
  await expect(page.locator('.info-card h3')).toHaveText('Kalender Akademik');
  await expect(page.locator('#share-info')).toBeHidden();
  expect(state.informationPosts).toHaveLength(1);
});


test('student can submit private verification evidence and sees a pending review state', async ({ page }) => {
  const state = await mockSupabase(page);
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('[data-page="verification"]').first().click();
  await expect(page.locator('#verification-status-panel')).toContainText('Belum terverifikasi');
  await page.locator('#verification-file').setInputFiles({
    name: 'KRS-semester-berjalan.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 sample'),
  });
  await page.locator('#verification-consent').check();
  await page.getByRole('button', { name: 'Kirim untuk diverifikasi' }).click();

  await expect(page.locator('#verification-submit-panel')).toContainText('Bukti sedang diperiksa');
  expect(state.verificationUploadCalls).toBe(1);
  expect(state.verificationSubmitCalls).toBe(1);
});

test('administrator can review a submitted student verification request', async ({ page }) => {
  const state = await mockSupabase(page, {
    isAdmin: true,
    verificationQueue: [{
      request_id: 'verification-request-001',
      user_id: 'another-student',
      full_name: 'Mahasiswa Antrean',
      faculty: 'Fakultas Sains dan Teknologi',
      program: 'Sistem Informasi',
      semester: 2,
      original_filename: 'Bukti-Registrasi.pdf',
      storage_path: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf',
      submitted_at: '2026-10-30T10:00:00.000Z',
    }],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('[data-page="verification"]').first().click();
  await expect(page.locator('#verification-admin-panel')).toBeVisible();
  await expect(page.locator('#verification-queue')).toContainText('Mahasiswa Antrean');
  await page.locator('[data-verification-approve="verification-request-001"]').click();
  await page.locator('#modal-confirm').click();

  await expect(page.locator('#verification-queue')).toContainText('Belum ada permohonan masuk');
  expect(state.verificationReviewCalls).toHaveLength(1);
  expect(state.verificationReviewCalls[0].p_decision).toBe('approved');
  expect(state.verificationReviewCalls[0].p_request_id).toBe('verification-request-001');
});


test('administrator must provide a reason when rejecting student verification', async ({ page }) => {
  const state = await mockSupabase(page, {
    isAdmin: true,
    verificationQueue: [{
      request_id: 'verification-request-002',
      user_id: 'b2d3e4f5-a6b7-48c9-8012-34567890abcd',
      full_name: 'Mahasiswa Perlu Perbaikan',
      faculty: 'Fakultas Sains dan Teknologi',
      program: 'Sistem Informasi',
      semester: 2,
      original_filename: 'Dokumen.pdf',
      storage_path: 'b2d3e4f5-a6b7-48c9-8012-34567890abcd/c3e4f5a6-b7c8-4901-8234-567890abcdef.pdf',
      submitted_at: '2026-10-30T10:00:00.000Z',
    }],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('[data-page="verification"]').first().click();
  await page.locator('[data-verification-reject="verification-request-002"]').click();
  await page.locator('#modal-confirm').click();
  await expect(page.locator('#toast')).toContainText('Alasan penolakan minimal 5 karakter');
  expect(state.verificationReviewCalls).toHaveLength(0);

  await page.locator('#verification-reject-note').fill('Bukti registrasi semester berjalan belum terlihat.');
  await page.locator('#modal-confirm').click();
  expect(state.verificationReviewCalls).toHaveLength(1);
  expect(state.verificationReviewCalls[0].p_decision).toBe('rejected');
  expect(state.verificationReviewCalls[0].p_review_note).toContain('Bukti registrasi');
});
