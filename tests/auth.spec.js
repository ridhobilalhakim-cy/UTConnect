import { test, expect } from '@playwright/test';

const SUPABASE_URL = 'https://hqyusbyndtlfypdbmatw.supabase.co';
const STORAGE_KEY = 'utconnect-hqyusbyndtlfypdbmatw-auth';
const USER = {
  id: 'e2e-student-001',
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

async function mockSupabase(page) {
  const state = { loginCalls: 0, recoveryCalls: 0, passwordUpdates: 0, logoutCalls: 0 };
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
