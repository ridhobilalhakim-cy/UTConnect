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

async function mockSupabase(page, { isAdmin = false, informationPosts = [], verificationStatus = { profile_status: 'pending', latest_request: null }, verificationQueue = [], profile = PROFILE, forumPosts = [], forumComments = [], courses = [], studyGroups = [], groupMembers = [], matchingPreferences = null, profileCourseIds = [], matchingCandidates = [], connectionSummaries = [], directMessages = [], notifications = [], homeMapLocation = null, nearbyResults = [] } = {}) {
  const state = { loginCalls: 0, recoveryCalls: 0, passwordUpdates: 0, logoutCalls: 0, informationPosts: [...informationPosts], informationCreateCalls: 0, verificationStatus: structuredClone(verificationStatus), verificationQueue: [...verificationQueue], verificationUploadCalls: 0, verificationSubmitCalls: 0, verificationReviewCalls: [], profile, forumPosts: [...forumPosts], forumComments: [...forumComments], courses: [...courses], studyGroups: [...studyGroups], groupMembers: [...groupMembers], groupCreateCalls: 0, groupJoinCalls: [], groupReviewCalls: [], matchingPreferences: matchingPreferences ? structuredClone(matchingPreferences) : null, profileCourseIds: [...profileCourseIds], matchingCandidates: [...matchingCandidates], connectionSummaries: [...connectionSummaries], directMessages: structuredClone(directMessages), directMessageSendCalls: [], directMessageReadCalls: [], notifications: structuredClone(notifications), notificationReadCalls: [], notificationBulkReadCalls: 0, homeMapLocation: structuredClone(homeMapLocation), nearbyResults: structuredClone(nearbyResults), nearbyCalls: [], locationSaveCalls: [], locationVisibilityCalls: [], matchingPreferenceSaveCalls: 0, profileCourseInsertCalls: 0, profileCourseDeleteCalls: 0, matchingSearchCalls: [], connectionCreateCalls: [], connectionResponseCalls: [], forumPostCreateCalls: 0, forumCommentCreateCalls: 0 };
  await page.addInitScript(() => { window.__UTCONNECT_DISABLE_REALTIME__ = true; });
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
    if (path.endsWith('/functions/v1/manage-my-location') && method === 'POST') {
      const input = request.postDataJSON();
      if (input.action === 'get') return route.fulfill(jsonResponse({ location: state.homeMapLocation }));
      if (input.action === 'save') {
        if (input.consent !== true || typeof input.show_in_radar !== 'boolean') {
          return route.fulfill(jsonResponse({ error: 'location consent required' }, 400));
        }
        state.locationSaveCalls.push(input);
        state.homeMapLocation = {
          latitude: input.lat,
          longitude: input.lng,
          show_in_radar: input.show_in_radar,
          consented_at: new Date().toISOString(),
        };
        return route.fulfill(jsonResponse({ success: true }));
      }
      if (input.action === 'visibility') {
        state.locationVisibilityCalls.push(input);
        if (!state.homeMapLocation) return route.fulfill(jsonResponse({ error: 'location missing' }, 404));
        state.homeMapLocation.show_in_radar = input.show_in_radar;
        return route.fulfill(jsonResponse({ success: true, show_in_radar: input.show_in_radar }));
      }
      return route.fulfill(jsonResponse({ error: 'unknown location action' }, 400));
    }
    if (path.endsWith('/functions/v1/nearby-students') && method === 'POST') {
      const input = request.postDataJSON();
      state.nearbyCalls.push(input);
      return route.fulfill(jsonResponse({
        radius: input.radius,
        results: state.nearbyResults,
        message: state.nearbyResults.length ? null : 'Tidak ditemukan mahasiswa.',
      }));
    }
    if (path.endsWith('/rest/v1/courses') && method === 'GET') {
      return route.fulfill(jsonResponse(state.courses));
    }
    if (path.endsWith('/rest/v1/matching_preferences')) {
      if (method === 'GET') return route.fulfill(jsonResponse(state.matchingPreferences ? [state.matchingPreferences] : []));
      if (method === 'POST') {
        state.matchingPreferenceSaveCalls += 1;
        state.matchingPreferences = request.postDataJSON();
        return route.fulfill(jsonResponse(state.matchingPreferences));
      }
    }
    if (path.endsWith('/rest/v1/profile_courses')) {
      if (method === 'GET') return route.fulfill(jsonResponse(state.profileCourseIds.map(course_id => ({ user_id: USER.id, course_id }))));
      if (method === 'POST') {
        const input = request.postDataJSON();
        const rows = Array.isArray(input) ? input : [input];
        for (const row of rows) {
          if (row.user_id !== USER.id) return route.fulfill(jsonResponse({ message: 'course owner mismatch' }, 403));
          if (!state.profileCourseIds.includes(row.course_id)) state.profileCourseIds.push(row.course_id);
        }
        state.profileCourseInsertCalls += rows.length;
        return route.fulfill(jsonResponse(rows, 201));
      }
      if (method === 'DELETE') {
        const filter = url.searchParams.get('course_id') || '';
        const removeIds = filter.startsWith('in.(') ? filter.slice(4, -1).split(',') : [];
        state.profileCourseIds = state.profileCourseIds.filter(id => !removeIds.includes(id));
        state.profileCourseDeleteCalls += 1;
        return route.fulfill({ status: 204, body: '' });
      }
    }
    if (path.endsWith('/rest/v1/rpc/find_matching_students') && method === 'POST') {
      const input = request.postDataJSON();
      state.matchingSearchCalls.push(input);
      return route.fulfill(jsonResponse(state.matchingCandidates));
    }
    if (path.endsWith('/rest/v1/rpc/get_my_connection_summaries') && method === 'POST') {
      return route.fulfill(jsonResponse(state.connectionSummaries));
    }
    if (path.endsWith('/rest/v1/rpc/respond_connection_request') && method === 'POST') {
      const input = request.postDataJSON();
      state.connectionResponseCalls.push(input);
      const connection = state.connectionSummaries.find(item => item.connection_id === input.p_connection_id);
      if (!connection || !connection.is_incoming || connection.status !== 'pending') {
        return route.fulfill(jsonResponse({ message: 'incoming request not found' }, 403));
      }
      connection.status = input.p_accept ? 'accepted' : 'rejected';
      return route.fulfill(jsonResponse(connection.status));
    }
    if (path.endsWith('/rest/v1/connections') && method === 'POST') {
      const input = request.postDataJSON();
      if (input.initiator_id !== USER.id || input.recipient_id === USER.id || input.status !== 'pending') {
        return route.fulfill(jsonResponse({ message: 'connection insert policy denied' }, 403));
      }
      const created = {
        id: 'connection-e2e-001',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...input,
      };
      state.connectionCreateCalls.push(input);
      const candidate = state.matchingCandidates.find(item => item.student_id === input.recipient_id);
      state.connectionSummaries.unshift({
        connection_id: created.id,
        other_student_id: input.recipient_id,
        initials: candidate?.initials || 'UT',
        program: candidate?.program || 'Program studi tidak tersedia',
        status: 'pending',
        created_at: created.created_at,
        is_incoming: false,
      });
      return route.fulfill(jsonResponse(created, 201));
    }
    if (path.endsWith('/rest/v1/notifications')) {
      const userFilter = url.searchParams.get('user_id') || '';
      if (userFilter !== `eq.${USER.id}`) {
        return route.fulfill(jsonResponse({ message: 'notification owner filter required' }, 403));
      }
      if (method === 'GET') {
        const rows = state.notifications
          .filter(item => item.user_id === USER.id)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, Number(url.searchParams.get('limit') || 40));
        return route.fulfill(jsonResponse(rows));
      }
      if (method === 'PATCH') {
        const input = request.postDataJSON();
        if (url.searchParams.get('read_at') !== 'is.null' || !input.read_at) {
          return route.fulfill(jsonResponse({ message: 'invalid notification update' }, 400));
        }
        const idFilter = url.searchParams.get('id') || '';
        const updated = [];
        if (idFilter.startsWith('eq.')) {
          const notification = state.notifications.find(item => item.id === idFilter.slice(3) && item.user_id === USER.id && item.read_at == null);
          if (notification) {
            notification.read_at = input.read_at;
            updated.push({ id: notification.id, read_at: notification.read_at });
            state.notificationReadCalls.push(notification.id);
          }
          return route.fulfill(jsonResponse(updated[0] || null));
        }
        for (const notification of state.notifications) {
          if (notification.user_id === USER.id && notification.read_at == null) {
            notification.read_at = input.read_at;
            updated.push({ id: notification.id });
          }
        }
        state.notificationBulkReadCalls += 1;
        return route.fulfill(jsonResponse(updated));
      }
    }
    if (path.endsWith('/rest/v1/direct_messages')) {
      const connectionFilter = url.searchParams.get('connection_id') || '';
      const connectionId = connectionFilter.startsWith('eq.') ? connectionFilter.slice(3) : '';
      if (method === 'GET') {
        const rows = state.directMessages
          .filter(message => !connectionId || message.connection_id === connectionId)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, Number(url.searchParams.get('limit') || 60));
        return route.fulfill(jsonResponse(rows));
      }
      if (method === 'POST') {
        const input = request.postDataJSON();
        const connection = state.connectionSummaries.find(item => item.connection_id === input.connection_id && item.status === 'accepted');
        if (!connection || input.sender_id !== USER.id) {
          return route.fulfill(jsonResponse({ message: 'direct message policy denied' }, 403));
        }
        const body = String(input.body || '').trim();
        if (!body || Array.from(body).length > 5000) {
          return route.fulfill(jsonResponse({ message: 'invalid message body' }, 400));
        }
        const created = {
          id: `direct-message-e2e-${state.directMessages.length + 1}`,
          created_at: new Date().toISOString(),
          read_at: null,
          ...input,
        };
        state.directMessageSendCalls.push(input);
        state.directMessages.push(created);
        return route.fulfill(jsonResponse(created, 201));
      }
      if (method === 'PATCH') {
        const input = request.postDataJSON();
        const senderFilter = url.searchParams.get('sender_id') || '';
        const readFilter = url.searchParams.get('read_at') || '';
        if (senderFilter !== `neq.${USER.id}` || readFilter !== 'is.null') {
          return route.fulfill(jsonResponse({ message: 'read receipt policy denied' }, 403));
        }
        state.directMessageReadCalls.push({ connection_id: connectionId, read_at: input.read_at });
        const updated = [];
        for (const message of state.directMessages) {
          if (message.connection_id === connectionId && message.sender_id !== USER.id && message.read_at == null) {
            message.read_at = input.read_at;
            updated.push({ id: message.id });
          }
        }
        return route.fulfill(jsonResponse(updated));
      }
    }
    if (path.endsWith('/rest/v1/study_groups')) {
      if (method === 'GET') return route.fulfill(jsonResponse(state.studyGroups.filter(group => !group.is_archived)));
      if (method === 'POST') {
        const input = request.postDataJSON();
        if (input.created_by !== USER.id) return route.fulfill(jsonResponse({ message: 'creator mismatch' }, 403));
        const created = {
          id: 'group-e2e-001',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          course: state.courses.find(course => course.id === input.course_id) || null,
          is_archived: false,
          ...input,
        };
        state.groupCreateCalls += 1;
        state.studyGroups.unshift(created);
        state.groupMembers.push({
          group_id: created.id,
          user_id: USER.id,
          role: 'admin',
          status: 'active',
          created_at: created.created_at,
          joined_at: created.created_at,
        });
        return route.fulfill(jsonResponse(created, 201));
      }
    }
    if (path.endsWith('/rest/v1/group_members') && method === 'GET') {
      const groupFilter = url.searchParams.get('group_id') || '';
      const userFilter = url.searchParams.get('user_id') || '';
      const requestedIds = groupFilter.startsWith('in.(')
        ? groupFilter.slice(4, -1).split(',')
        : groupFilter.startsWith('eq.')
          ? [groupFilter.slice(3)]
          : null;
      const requestedUserId = userFilter.startsWith('eq.') ? userFilter.slice(3) : null;
      const rows = state.groupMembers.filter(member => {
        if (requestedIds && !requestedIds.includes(member.group_id)) return false;
        if (requestedUserId && member.user_id !== requestedUserId) return false;
        const currentUserIsActive = state.groupMembers.some(row =>
          row.group_id === member.group_id && row.user_id === USER.id && row.status === 'active'
        );
        return member.user_id === USER.id || currentUserIsActive;
      });
      return route.fulfill(jsonResponse(rows));
    }
    if (path.endsWith('/rest/v1/rpc/join_study_group') && method === 'POST') {
      const input = request.postDataJSON();
      state.groupJoinCalls.push(input);
      if (input.p_actor_id !== USER.id) return route.fulfill(jsonResponse({ message: 'actor mismatch' }, 403));
      const group = state.studyGroups.find(item => item.id === input.p_group_id);
      if (!group) return route.fulfill(jsonResponse({ message: 'group not found' }, 404));
      const status = group.access_type === 'approval' ? 'pending' : 'active';
      const existing = state.groupMembers.find(member => member.group_id === group.id && member.user_id === USER.id);
      if (existing) Object.assign(existing, { status, role: 'member', joined_at: status === 'active' ? new Date().toISOString() : null });
      else state.groupMembers.push({ group_id: group.id, user_id: USER.id, role: 'member', status, created_at: new Date().toISOString(), joined_at: status === 'active' ? new Date().toISOString() : null });
      return route.fulfill(jsonResponse(status));
    }
    if (path.endsWith('/rest/v1/rpc/respond_group_join_request') && method === 'POST') {
      const input = request.postDataJSON();
      state.groupReviewCalls.push(input);
      if (input.p_actor_id !== USER.id) return route.fulfill(jsonResponse({ message: 'actor mismatch' }, 403));
      const member = state.groupMembers.find(item => item.group_id === input.p_group_id && item.user_id === input.p_user_id && item.status === 'pending');
      if (!member || member.role === 'admin') return route.fulfill(jsonResponse({ message: 'request not found' }, 400));
      member.status = input.p_accept ? 'active' : 'rejected';
      member.joined_at = input.p_accept ? new Date().toISOString() : null;
      return route.fulfill(jsonResponse(member.status));
    }
    if (path.endsWith('/rest/v1/forum_posts')) {
      if (method === 'GET') return route.fulfill(jsonResponse([...state.forumPosts].reverse()));
      if (method === 'POST') {
        const input = request.postDataJSON();
        const created = { id: 'forum-post-e2e-001', author_id: USER.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), course: null, ...input };
        state.forumPostCreateCalls += 1;
        state.forumPosts.unshift(created);
        return route.fulfill(jsonResponse(created, 201));
      }
      if (method === 'DELETE') {
        const id = url.searchParams.get('id')?.replace(/^eq\./, '');
        state.forumPosts = state.forumPosts.filter(item => item.id !== id);
        return route.fulfill({ status: 204, body: '' });
      }
    }
    if (path.endsWith('/rest/v1/forum_comments')) {
      if (method === 'GET') {
        const postId = url.searchParams.get('post_id')?.replace(/^eq\./, '');
        return route.fulfill(jsonResponse(state.forumComments.filter(item => item.post_id === postId)));
      }
      if (method === 'POST') {
        const input = request.postDataJSON();
        const created = { id: 'forum-comment-e2e-001', author_id: USER.id, created_at: new Date().toISOString(), ...input };
        state.forumCommentCreateCalls += 1;
        state.forumComments.push(created);
        return route.fulfill(jsonResponse(created, 201));
      }
      if (method === 'DELETE') {
        const id = url.searchParams.get('id')?.replace(/^eq\./, '');
        state.forumComments = state.forumComments.filter(item => item.id !== id);
        return route.fulfill({ status: 204, body: '' });
      }
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
      return route.fulfill(jsonResponse([profile]));
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


test('unverified student sees the forum gate and cannot compose a discussion', async ({ page }) => {
  const state = await mockSupabase(page, { profile: { ...PROFILE, verification_status: 'pending' } });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('[data-page="forum"]').first().click();
  await expect(page.locator('#forum-access-notice')).toContainText('Forum khusus mahasiswa terverifikasi');
  await expect(page.locator('#forum-compose')).toBeHidden();
  await expect(page.locator('#new-post')).toBeHidden();
  expect(state.forumPostCreateCalls).toBe(0);
});

test('verified student can publish a forum post and add a comment', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: { ...PROFILE, verification_status: 'verified' },
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('[data-page="forum"]').first().click();
  await expect(page.locator('#forum-compose')).toBeVisible();
  await expect(page.locator('#post-course')).toContainText('Diskusi umum');
  await page.locator('#post-title').fill('Memahami perulangan bersarang');
  await page.locator('#post-type').selectOption('need_help');
  await page.locator('#post-content').fill('Bagaimana menentukan kondisi berhenti pada perulangan bersarang?');
  await page.locator('#publish-post').click();

  await expect(page.locator('.forum-post-title')).toHaveText('Memahami perulangan bersarang');
  expect(state.forumPostCreateCalls).toBe(1);
  expect(state.forumPosts[0].author_id).toBe(USER.id);
  expect(state.forumPosts[0].post_type).toBe('need_help');

  await page.locator('[data-forum-thread="forum-post-e2e-001"]').click();
  await page.locator('#forum-comment-input').fill('Perhatikan kondisi pada setiap perulangan.');
  await page.locator('#forum-comment-send').click();

  await expect(page.locator('#modal-content')).toContainText('Perhatikan kondisi pada setiap perulangan.');
  expect(state.forumCommentCreateCalls).toBe(1);
});

test('verified student can read a live forum post without exposing another profile identity', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: { ...PROFILE, verification_status: 'verified' },
    forumPosts: [{
      id: 'forum-post-public-001',
      author_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      course_id: null,
      post_type: 'discussion',
      title: 'Belajar mandiri di UT',
      body: 'Apa strategi kalian membagi waktu belajar?',
      created_at: '2026-10-30T10:00:00.000Z',
      updated_at: '2026-10-30T10:00:00.000Z',
      course: null,
    }],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('[data-page="forum"]').first().click();
  await expect(page.locator('.forum-post-title')).toHaveText('Belajar mandiri di UT');
  await expect(page.locator('.post-author')).toContainText('Mahasiswa UT');
  expect(state.forumPosts).toHaveLength(1);
});


test('unverified student cannot discover or create study groups', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: { ...PROFILE, verification_status: 'pending' },
    studyGroups: [{ id: 'group-hidden-001', name: 'Grup Terbatas', access_type: 'open', mode: 'online', capacity: 10, is_archived: false }],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('[data-page="groups"]').first().click();
  await expect(page.locator('#group-access-notice')).toContainText('Verifikasi mahasiswa diperlukan');
  await expect(page.locator('#group-toolbar')).toBeHidden();
  await expect(page.locator('#create-group')).toBeHidden();
  await expect(page.locator('.group-card')).toHaveCount(0);
  expect(state.groupCreateCalls).toBe(0);
  expect(state.groupJoinCalls).toHaveLength(0);
});

test('verified student can create a persisted general study group', async ({ page }) => {
  const state = await mockSupabase(page, { profile: { ...PROFILE, verification_status: 'verified' } });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('[data-page="groups"]').first().click();
  await page.locator('#create-group').click();
  await page.locator('#new-group-name').fill('Kelompok Belajar Sistem Informasi');
  await page.locator('#new-group-description').fill('Belajar bersama dan membahas materi perkuliahan.');
  await page.locator('#new-group-course').selectOption('');
  await page.locator('#new-group-mode').selectOption('online');
  await page.locator('#new-group-access').selectOption('open');
  await page.locator('#new-group-capacity').fill('12');
  await page.locator('#new-group-schedule').fill('Sabtu, 19.00 WIB');
  await page.locator('#modal-confirm').click();

  await expect(page.locator('.group-card')).toContainText('Kelompok Belajar Sistem Informasi');
  await expect(page.locator('.group-card')).toContainText('Kelompok umum');
  expect(state.groupCreateCalls).toBe(1);
  expect(state.studyGroups[0].created_by).toBe(USER.id);
  expect(state.studyGroups[0].access_type).toBe('open');
  expect(state.groupMembers.some(member => member.group_id === 'group-e2e-001' && member.user_id === USER.id && member.role === 'admin')).toBe(true);
});

test('verified student can request to join an approval-based study group', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: { ...PROFILE, verification_status: 'verified' },
    studyGroups: [{
      id: 'group-approval-001',
      created_by: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'Kelompok Persiapan UAS',
      description: 'Diskusi persiapan ujian.',
      course_id: null,
      course: null,
      mode: 'online',
      capacity: 10,
      access_type: 'approval',
      schedule_text: 'Minggu malam',
      online_url: null,
      offline_area_label: null,
      is_archived: false,
      created_at: '2026-10-30T10:00:00.000Z',
    }],
    groupMembers: [{
      group_id: 'group-approval-001',
      user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      role: 'admin',
      status: 'active',
      created_at: '2026-10-01T10:00:00.000Z',
      joined_at: '2026-10-01T10:00:00.000Z',
    }],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('[data-page="groups"]').first().click();
  await expect(page.locator('.group-card')).toContainText('Kelompok Persiapan UAS');
  await page.locator('[data-group-join="group-approval-001"]').click();

  await expect(page.locator('.group-card')).toContainText('Menunggu persetujuan');
  expect(state.groupJoinCalls).toHaveLength(1);
  expect(state.groupJoinCalls[0].p_actor_id).toBe(USER.id);
  expect(state.groupMembers.some(member => member.group_id === 'group-approval-001' && member.user_id === USER.id && member.status === 'pending')).toBe(true);
});

test('group admin can approve a pending membership request', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: { ...PROFILE, verification_status: 'verified' },
    studyGroups: [{
      id: 'group-admin-001',
      created_by: USER.id,
      name: 'Ruang Belajar UT',
      description: 'Kelompok belajar bersama.',
      course_id: null,
      course: null,
      mode: 'offline',
      capacity: 12,
      access_type: 'approval',
      schedule_text: 'Sabtu pagi',
      online_url: null,
      offline_area_label: 'Bandung',
      is_archived: false,
      created_at: '2026-10-30T10:00:00.000Z',
    }],
    groupMembers: [
      { group_id: 'group-admin-001', user_id: USER.id, role: 'admin', status: 'active', created_at: '2026-10-01T10:00:00.000Z', joined_at: '2026-10-01T10:00:00.000Z' },
      { group_id: 'group-admin-001', user_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', role: 'member', status: 'pending', created_at: '2026-10-30T11:00:00.000Z', joined_at: null },
    ],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('[data-page="groups"]').first().click();
  await page.locator('[data-group-open="group-admin-001"]').click();
  await expect(page.locator('#modal-content')).toContainText('Permohonan bergabung (1)');
  await page.locator('[data-group-review="approve"]').click();
  await page.locator('#modal-confirm').click();

  await expect.poll(() => state.groupReviewCalls.length).toBe(1);
  expect(state.groupReviewCalls[0].p_actor_id).toBe(USER.id);
  expect(state.groupReviewCalls[0].p_user_id).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  expect(state.groupReviewCalls[0].p_accept).toBe(true);
  expect(state.groupMembers.find(member => member.user_id === 'cccccccc-cccc-4ccc-8ccc-cccccccccccc').status).toBe('active');
});


test('verified student sees real nearby map results from the secure endpoint', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: { ...PROFILE, verification_status: 'verified' },
    homeMapLocation: {
      latitude: -6.9175,
      longitude: 107.6191,
      show_in_radar: true,
      consented_at: '2026-10-31T10:00:00.000Z',
    },
    nearbyResults: [{
      student_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      initials: 'DP',
      program: 'Sistem Informasi',
      approx_distance_m: 550,
      marker_lat: -6.9168,
      marker_lng: 107.6201,
    }],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await expect.poll(() => state.nearbyCalls.length).toBe(1);
  await expect(page.locator('#nearby-list')).toContainText('Mahasiswa DP');
  await expect(page.locator('#nearby-list')).toContainText('Sistem Informasi');
  await expect(page.locator('#nearby-list')).toContainText('0.6 km');
  await expect(page.locator('#map-result')).toContainText('1 mahasiswa terverifikasi');
  expect(state.nearbyCalls[0]).toEqual({ radius: 3000 });
  expect(await page.locator('#nearby-list').innerText()).not.toContain('049');
});

test('verified student NIM search is sent only in the authenticated request body', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: { ...PROFILE, verification_status: 'verified' },
    homeMapLocation: {
      latitude: -6.9175,
      longitude: 107.6191,
      show_in_radar: false,
      consented_at: '2026-10-31T10:00:00.000Z',
    },
    nearbyResults: [{
      student_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      initials: 'DP',
      program: 'Sistem Informasi',
      approx_distance_m: 1200,
      marker_lat: -6.9168,
      marker_lng: 107.6201,
    }],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();
  await expect.poll(() => state.nearbyCalls.length).toBe(1);

  await page.locator('#nim-search').fill('049123456');
  await expect.poll(() => state.nearbyCalls.length).toBe(2);
  expect(state.nearbyCalls[1]).toEqual({ radius: 3000, nim: '049123456' });
  expect(await page.locator('#nim-search').inputValue()).toBe('049123456');
  expect(page.url()).not.toContain('049123456');
});

test('student can hide their map pin without losing the ability to browse nearby peers', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: { ...PROFILE, verification_status: 'verified' },
    homeMapLocation: {
      latitude: -6.9175,
      longitude: 107.6191,
      show_in_radar: true,
      consented_at: '2026-10-31T10:00:00.000Z',
    },
    nearbyResults: [],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();
  await expect.poll(() => state.nearbyCalls.length).toBe(1);

  await page.locator('#map-radar-toggle').uncheck();
  await expect.poll(() => state.locationVisibilityCalls.length).toBe(1);
  expect(state.locationVisibilityCalls[0]).toEqual({
    action: 'visibility',
    show_in_radar: false,
    consent: false,
  });
  expect(state.homeMapLocation.show_in_radar).toBe(false);
  await expect(page.locator('#map-result')).toContainText('0 mahasiswa terverifikasi');
  expect(state.nearbyCalls).toHaveLength(1);
});

test('unverified student cannot access matching search or connection controls', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: { ...PROFILE, verification_status: 'pending' },
    matchingCandidates: [{ student_id: 'hidden-candidate', initials: 'AB', program: 'Sistem Informasi', approx_distance_m: 500 }],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('[data-page="matching"]').first().click();
  await expect(page.locator('#match-access-notice')).toContainText('Verifikasi mahasiswa diperlukan');
  await expect(page.locator('#match-layout')).toBeHidden();
  await expect(page.locator('#match-results')).toBeEmpty();
  expect(state.matchingSearchCalls).toHaveLength(0);
  expect(state.matchingPreferenceSaveCalls).toBe(0);
  expect(state.connectionCreateCalls).toHaveLength(0);
});

test('verified student can save personal matching preferences and selected courses', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: { ...PROFILE, verification_status: 'verified' },
    courses: [
      { id: 'course-001', course_code: 'MSIM4201', course_name: 'Sistem Operasi', is_active: true },
      { id: 'course-002', course_code: 'MSIM4301', course_name: 'Algoritma Pemrograman', is_active: true },
    ],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('[data-page="matching"]').first().click();
  await page.locator('#preference-topics').fill('struktur data, algoritma');
  await page.locator('#preference-interests').fill('belajar kelompok, persiapan UAS');
  await page.locator('#preference-study-times').selectOption(['Malam hari', 'Akhir pekan']);
  await page.locator('#preferred-courses').selectOption(['course-001']);
  await page.locator('#save-matching-preferences').click();

  await expect(page.locator('#toast')).toContainText('Preferensi belajar berhasil disimpan');
  expect(state.matchingPreferenceSaveCalls).toBe(1);
  expect(state.matchingPreferences.topic_tags).toEqual(['struktur data', 'algoritma']);
  expect(state.matchingPreferences.interests).toEqual(['belajar kelompok', 'persiapan UAS']);
  expect(state.matchingPreferences.study_times).toEqual(['Malam hari', 'Akhir pekan']);
  expect(state.profileCourseIds).toEqual(['course-001']);
  expect(state.profileCourseInsertCalls).toBe(1);
  expect(state.matchingSearchCalls.length).toBeGreaterThan(0);
});

test('verified student can search privacy-limited matches and send a connection request', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: { ...PROFILE, verification_status: 'verified' },
    matchingCandidates: [{
      student_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      initials: 'RA',
      program: 'Manajemen',
      approx_distance_m: 1250,
      course_names: ['Pengantar Manajemen'],
      topic_tags: ['manajemen waktu'],
      interests: ['belajar kelompok'],
      study_times: ['Malam hari'],
      full_name: 'Nama Lengkap Rahasia',
      marker_lat: -6.9,
      marker_lng: 107.6,
    }],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('[data-page="matching"]').first().click();
  await expect(page.locator('.match-card')).toContainText('Mahasiswa UT · RA');
  await expect(page.locator('.match-card')).toContainText('Manajemen');
  await expect(page.locator('.match-card')).toContainText('sekitar 1,5 km');
  await expect(page.locator('.match-card')).not.toContainText('Nama Lengkap Rahasia');
  await page.locator('[data-connect="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]').click();

  await expect(page.locator('#connection-panel')).toBeVisible();
  await expect(page.locator('#connection-list')).toContainText('Menunggu jawaban');
  expect(state.matchingSearchCalls[0].p_radius_m).toBe(3000);
  expect(state.connectionCreateCalls).toHaveLength(1);
  expect(state.connectionCreateCalls[0].initiator_id).toBe(USER.id);
  expect(state.connectionCreateCalls[0].recipient_id).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  expect(state.connectionCreateCalls[0].status).toBe('pending');
});

test('verified student can accept an incoming connection request', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: { ...PROFILE, verification_status: 'verified' },
    connectionSummaries: [{
      connection_id: 'connection-incoming-001',
      other_student_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      initials: 'DP',
      program: 'Sistem Informasi',
      status: 'pending',
      created_at: '2026-10-30T10:00:00.000Z',
      is_incoming: true,
    }],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('[data-page="matching"]').first().click();
  await page.locator('[data-connection-accept="connection-incoming-001"]').click();
  await page.locator('#modal-confirm').click();

  await expect(page.locator('[data-chat-open="connection-incoming-001"]')).toBeVisible();
  await expect.poll(() => state.connectionResponseCalls.length).toBe(1);
  expect(state.connectionResponseCalls[0]).toEqual({
    p_connection_id: 'connection-incoming-001',
    p_accept: true,
  });
  expect(state.connectionSummaries[0].status).toBe('accepted');
});

test('verified student can reject an incoming connection request', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: { ...PROFILE, verification_status: 'verified' },
    connectionSummaries: [{
      connection_id: 'connection-incoming-002',
      other_student_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      initials: 'SN',
      program: 'PGSD',
      status: 'pending',
      created_at: '2026-10-30T10:00:00.000Z',
      is_incoming: true,
    }],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('[data-page="matching"]').first().click();
  await page.locator('[data-connection-reject="connection-incoming-002"]').click();
  await page.locator('#modal-confirm').click();

  await expect(page.locator('#connection-list')).toContainText('Permintaan ditolak');
  expect(state.connectionResponseCalls).toHaveLength(1);
  expect(state.connectionResponseCalls[0].p_accept).toBe(false);
  expect(state.connectionSummaries[0].status).toBe('rejected');
});

test('verified student can open an accepted connection chat, read messages and send a persisted message', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: { ...PROFILE, verification_status: 'verified' },
    connectionSummaries: [{
      connection_id: '11111111-1111-4111-8111-111111111111',
      other_student_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      initials: 'RA',
      program: 'Manajemen',
      status: 'accepted',
      created_at: '2026-10-30T10:00:00.000Z',
      is_incoming: false,
    }],
    directMessages: [{
      id: 'direct-message-incoming-001',
      connection_id: '11111111-1111-4111-8111-111111111111',
      sender_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      body: '<script>window.__chatInjected = true</script>Halo! Kita belajar bareng?',
      created_at: '2026-10-30T11:00:00.000Z',
      read_at: null,
    }],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('[data-page="matching"]').first().click();
  await page.locator('[data-chat-open="11111111-1111-4111-8111-111111111111"]').click();

  await expect(page.locator('#modal-backdrop')).toHaveClass(/open/);
  await expect(page.locator('#modal-title')).toContainText('Mahasiswa UT · RA');
  await expect(page.locator('#direct-chat-messages')).toContainText('Halo! Kita belajar bareng?');
  await expect(page.locator('#direct-chat-messages script')).toHaveCount(0);
  await expect.poll(() => state.directMessages[0].read_at).not.toBeNull();

  await page.locator('#direct-chat-input').fill('Siap, aku akan bahas materi Sistem Operasi.');
  await page.locator('#direct-chat-send').click();
  await expect(page.locator('#direct-chat-messages')).toContainText('Siap, aku akan bahas materi Sistem Operasi.');
  expect(state.directMessageSendCalls).toHaveLength(1);
  expect(state.directMessageSendCalls[0]).toEqual({
    connection_id: '11111111-1111-4111-8111-111111111111',
    sender_id: USER.id,
    body: 'Siap, aku akan bahas materi Sistem Operasi.',
  });
  expect(state.directMessages.some(message => message.body === 'Siap, aku akan bahas materi Sistem Operasi.')).toBe(true);
});

test('chat action is unavailable while a connection request is still pending', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: { ...PROFILE, verification_status: 'verified' },
    connectionSummaries: [{
      connection_id: 'connection-chat-pending-001',
      other_student_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      initials: 'RA',
      program: 'Manajemen',
      status: 'pending',
      created_at: '2026-10-30T10:00:00.000Z',
      is_incoming: false,
    }],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('[data-page="matching"]').first().click();
  await expect(page.locator('#connection-list')).toContainText('Menunggu jawaban');
  await expect(page.locator('[data-chat-open]')).toHaveCount(0);
  expect(state.directMessageSendCalls).toHaveLength(0);
  expect(state.directMessageReadCalls).toHaveLength(0);
});

test('verified student can open a direct-message notification and mark it read', async ({ page }) => {
  const state = await mockSupabase(page, {
    profile: { ...PROFILE, verification_status: 'verified' },
    connectionSummaries: [{
      connection_id: '22222222-2222-4222-8222-222222222222',
      other_student_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      initials: 'RA',
      program: 'Manajemen',
      status: 'accepted',
      created_at: '2026-10-30T10:00:00.000Z',
      is_incoming: false,
    }],
    directMessages: [{
      id: 'direct-message-notification-001',
      connection_id: '22222222-2222-4222-8222-222222222222',
      sender_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      body: 'Ada waktu untuk diskusi?',
      created_at: '2026-10-30T11:00:00.000Z',
      read_at: null,
    }],
    notifications: [{
      id: 'notification-chat-001',
      user_id: USER.id,
      notification_type: 'direct_message',
      title: 'Pesan baru',
      body: 'Kamu menerima pesan baru dari koneksimu.',
      reference_id: '22222222-2222-4222-8222-222222222222',
      read_at: null,
      created_at: '2026-10-30T11:00:00.000Z',
    }],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('#notif-btn').click();
  await expect(page.locator('#notification-panel')).toBeVisible();
  await expect(page.locator('#notif-count')).toHaveText('1');
  await expect(page.locator('[data-notification-id="notification-chat-001"]')).toContainText('Pesan baru');
  await page.locator('[data-notification-id="notification-chat-001"]').click();

  await expect(page.locator('#modal-title')).toContainText('Mahasiswa UT · RA');
  await expect(page.locator('#direct-chat-messages')).toContainText('Ada waktu untuk diskusi?');
  expect(state.notificationReadCalls).toEqual(['notification-chat-001']);
  expect(state.notifications[0].read_at).not.toBeNull();
});

test('student can mark all notifications as read and clear the unread counter', async ({ page }) => {
  const now = new Date().toISOString();
  const state = await mockSupabase(page, {
    notifications: [
      { id: 'notification-all-001', user_id: USER.id, notification_type: 'connection_request', title: 'Permintaan koneksi baru', body: 'Seseorang mengirim permintaan koneksi.', reference_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', read_at: null, created_at: now },
      { id: 'notification-all-002', user_id: USER.id, notification_type: 'forum_comment', title: 'Diskusimu mendapat tanggapan', body: 'Ada tanggapan baru.', reference_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', read_at: null, created_at: now },
    ],
  });
  await page.goto('/');
  await page.locator('#loginEmail').fill(USER.email);
  await page.locator('#loginPassword').fill('ContohPassword123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).first().click();

  await page.locator('#notif-btn').click();
  await expect(page.locator('#notif-count')).toHaveText('2');
  await page.locator('#notif-mark-all').click();

  await expect(page.locator('#notif-count')).toBeHidden();
  await expect(page.locator('#notification-summary')).toContainText('Semua notifikasi sudah dibaca');
  await expect(page.locator('.notification-item.unread')).toHaveCount(0);
  expect(state.notificationBulkReadCalls).toBe(1);
  expect(state.notifications.every(item => item.read_at !== null)).toBe(true);
});

