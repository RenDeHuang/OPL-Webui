import { createHash } from 'node:crypto';

const configuredBaseUrl = process.env.OPL_BASE_URL?.trim();
const baseUrl = (configuredBaseUrl || 'https://opl.medopl.cn').replace(/\/$/, '');

export async function runCommercialConsumerE2E() {
  if (process.env.OPL_COMMERCIAL_CONSUMER_E2E !== '1') {
    console.log('[cloud-rollout] commercial consumer ready path e2e skipped; set OPL_COMMERCIAL_CONSUMER_E2E=1 to run.');
    return;
  }
  for (const name of [
    'OPL_DOGFOOD_EMAIL',
    'OPL_DOGFOOD_PASSWORD',
    'OPL_DOGFOOD_API_KEY',
    'MEDOPL_PUBLIC_BASE_URL',
    'MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256',
    'MEDOPL_WEBHOOK_SECRET',
  ]) {
    requireEnv(name);
  }
  validateDogfoodCredentials();
  validateCommercialConsumerSecrets();

  const medoplBaseUrl = process.env.MEDOPL_PUBLIC_BASE_URL.replace(/\/$/, '');
  const session = await dogfoodSession();
  const identity = await dogfoodFetch('/api/auth/login', {
    method: 'POST',
    body: { email: process.env.OPL_DOGFOOD_EMAIL, password: process.env.OPL_DOGFOOD_PASSWORD },
  }, 'commercial login');
  const context = {
    tenantId: requiredString(identity.body, 'tenantId', 'webui identity tenant'),
    portalUserId: requiredString(identity.body, 'userId', 'webui identity user'),
    workspaceId: requiredString(identity.body, 'workspaceId', 'webui identity workspace'),
  };
  const cookie = identity.cookie || session.cookie;

  await dogfoodFetch('/api/settings/model-provider', {
    method: 'PUT',
    cookie,
    body: { apiKey: process.env.OPL_DOGFOOD_API_KEY },
  }, 'commercial API Key binding');

  const medoplSession = await medoplSessionBootstrap(medoplBaseUrl, context);
  const medoplRequest = (path, options = {}, label, expected = 200) => medoplFetch(medoplBaseUrl, path, {
    ...options,
    session: medoplSession,
    identity: context,
  }, label, expected);

  await medoplRequest('/api/v22/users/prepare', { method: 'POST', body: context }, 'prepare MedOPL account');
  await medoplRequest('/api/v22/users/approve', { method: 'POST', body: context }, 'approve MedOPL account');
  const order = await medoplRequest('/api/v22/billing/payment-orders', {
    method: 'POST',
    body: { ...context, amount: 100, currency: 'CNY', idempotencyKey: `${context.workspaceId}-commercial-consumer-order` },
  }, 'create MedOPL internal payment order');
  const orderId = requiredString(order.body, 'orderId', 'payment order');
  await medoplFetch(medoplBaseUrl, '/api/v22/billing/payment-paid', {
    method: 'POST',
    identity: context,
    webhookSecret: process.env.MEDOPL_WEBHOOK_SECRET,
    body: {
      ...context,
      orderId,
      amount: 100,
      currency: 'CNY',
      idempotencyKey: `${context.workspaceId}-commercial-consumer-paid`,
      providerRef: 'opl-webui-commercial-consumer-canary-redacted',
    },
  }, 'mark MedOPL internal payment paid');
  await medoplRequest('/api/v22/provider-key', {
    method: 'POST',
    body: {
      ...context,
      apiKey: 'opl-webui-commercial-consumer-provider-key-redacted',
      idempotencyKey: `${context.workspaceId}-commercial-consumer-provider`,
    },
  }, 'bind MedOPL provider key');
  const opened = await medoplRequest('/api/v22/managed-environment/open', {
    method: 'POST',
    body: { ...context, idempotencyKey: `${context.workspaceId}-commercial-consumer-open-runtime` },
  }, 'open MedOPL runtime storage');
  const launchId = requiredString(opened.body, 'launchId', 'MedOPL launch');
  const resourceBindingId = requiredString(opened.body, 'resourceBindingId', 'MedOPL resource binding');

  const medoplGate = await medoplRequest('/api/opl/runtime-gate', {
    method: 'POST',
    body: { ...context, invocationMode: 'runtime_required' },
  }, 'MedOPL runtime gate ready');
  assertEqual(medoplGate.body.ok, true, 'MedOPL runtime gate ready');
  assertEqual(medoplGate.body.runtimeState, 'ready', 'MedOPL runtime state');
  assertEqual(medoplGate.body.storageState, 'ready', 'MedOPL storage state');

  const file = await medoplRequest(`/api/opl/files?launchId=${encodeURIComponent(launchId)}`, {
    method: 'POST',
    body: {
      fileName: 'commercial-consumer-canary.csv',
      relativePath: 'inputs/commercial-consumer-canary.csv',
      contentType: 'text/csv',
      sizeBytes: 32,
    },
  }, 'MedOPL upload file ref');
  const fileRef = requiredString(file.body, 'fileRef', 'MedOPL file ref');

  const taskPayload = {
    taskIntent: 'paper_question',
    marker: '@论文',
    prompt: '@论文 commercial consumer ready path canary',
    conversationId: 'commercial-consumer-canary',
    gateRefs: { launchId, fileRefs: [fileRef] },
  };
  const webuiGate = await dogfoodFetch('/api/opl/runtime-gate', { method: 'POST', cookie, body: taskPayload }, 'WebUI runtime gate ready');
  assertEqual(webuiGate.body.ok, true, 'WebUI runtime gate ready');
  const run = await dogfoodFetch('/api/opl/runs', { method: 'POST', cookie, body: taskPayload }, 'WebUI runtime run');
  assertEqual(run.body.ok, true, 'WebUI runtime run');
  assertNoCommercialTruthLeak(run.body);

  const billing = await dogfoodFetch('/api/account/billing-summary', { cookie }, 'WebUI billing refs');
  assertEqual(billing.body.owner, 'MedOPL', 'WebUI billing owner');
  assertEqual(billing.body.webuiBillingSourceOfTruth, 'forbidden', 'WebUI billing truth boundary');
  assertEqual(billing.body.webuiPaymentMutation, 'forbidden', 'WebUI payment mutation boundary');

  const taskList = await dogfoodFetch('/api/tasks', { cookie }, 'WebUI task history');
  const task = firstTask(taskList.body, 'commercial-consumer-canary');
  const taskId = requiredString(task, 'taskId', 'WebUI task history');
  assertNoCommercialTruthLeak(taskList.body);
  const taskDetail = await dogfoodFetch(`/api/tasks/${encodeURIComponent(taskId)}`, { cookie }, 'WebUI task detail');
  assertEqual(taskDetail.body.task?.taskId, taskId, 'WebUI task detail id');
  assertNoCommercialTruthLeak(taskDetail.body);

  await dogfoodFetch('/api/auth/logout', { method: 'POST', cookie }, 'WebUI logout', 204);
  const resumed = await dogfoodFetch('/api/auth/login', {
    method: 'POST',
    body: { email: process.env.OPL_DOGFOOD_EMAIL, password: process.env.OPL_DOGFOOD_PASSWORD },
  }, 'WebUI resume login');
  const resumedList = await dogfoodFetch('/api/tasks', { cookie: resumed.cookie }, 'WebUI resumed task history');
  const resumedTask = firstTask(resumedList.body, 'commercial-consumer-canary');
  assertEqual(resumedTask.taskId, taskId, 'WebUI resumed task id');
  const resumedDetail = await dogfoodFetch(`/api/tasks/${encodeURIComponent(taskId)}`, { cookie: resumed.cookie }, 'WebUI resumed task detail');
  assertEqual(resumedDetail.body.task?.taskId, taskId, 'WebUI resumed task detail id');
  assertNoCommercialTruthLeak(resumedDetail.body);

  await medoplRequest('/api/v22/managed-environment/release', {
    method: 'POST',
    body: {
      workspaceId: context.workspaceId,
      resourceBindingId,
      stopBilling: true,
      idempotencyKey: `${context.workspaceId}-commercial-consumer-release`,
    },
  }, 'release MedOPL runtime');
  await medoplRequest('/api/v22/storage/destroy', {
    method: 'POST',
    body: {
      workspaceId: context.workspaceId,
      resourceBindingId,
      storageBindingId: medoplGate.body.storageBindingId || file.body.storageBindingId || 'storage-canary',
      idempotencyKey: `${context.workspaceId}-commercial-consumer-destroy-storage`,
    },
  }, 'destroy MedOPL storage');

  const evidenceSummary = {
    schemaVersion: 1,
    mode: 'secret_gated_commercial_consumer_ready_path',
    targetHost: baseUrl,
    medoplHost: medoplBaseUrl,
    identityRefHash: hashPublicRef(`${context.tenantId}:${context.portalUserId}:${context.workspaceId}`),
    medoplReady: true,
    webuiTaskHistory: true,
    sessionResume: true,
    coverage: [
      'webui_register_or_login',
      'webui_api_key_binding',
      'medopl_prepare_approve_credit_provider_open_runtime_storage',
      'medopl_runtime_gate_ready',
      'webui_runtime_gate_ready',
      'webui_opl_runs_refs_only',
      'webui_billing_ledger_refs_only',
      'webui_task_history',
      'webui_session_resume',
      'medopl_release_destroy_storage',
    ],
    cannotClaim: [
      'external PSP settlement',
      'OPL-Webui payment truth',
      'OPL-Webui billing truth',
      'OPL-Webui runtime truth',
      'OPL-Webui storage truth',
      'artifact body authority',
      'all users/all tenants',
      'SLA/multi-region',
      'enterprise compliance',
    ],
    rawLogPolicy: { storesRawLogs: false, storesSecretValues: false },
  };
  assertNoSensitive(evidenceSummary);
  console.log(`[cloud-rollout] commercial consumer evidence summary ${JSON.stringify(evidenceSummary)}`);
  console.log('[cloud-rollout] commercial consumer ready path e2e passed');
}

async function dogfoodSession() {
  const credentials = { email: process.env.OPL_DOGFOOD_EMAIL, password: process.env.OPL_DOGFOOD_PASSWORD };
  const registered = await dogfoodFetch('/api/auth/register', { method: 'POST', body: credentials }, 'register', [201, 409]);
  if (registered.response.status === 201) return registered;
  return dogfoodFetch('/api/auth/login', { method: 'POST', body: credentials }, 'login');
}

async function dogfoodFetch(path, options, label, expected = 200) {
  const headers = { connection: 'close' };
  if (options?.body) headers['content-type'] = 'application/json';
  if (options?.cookie) headers.cookie = options.cookie;
  const response = await fetch(`${baseUrl}${path}`, {
    method: options?.method ?? 'GET',
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  const allowed = Array.isArray(expected) ? expected : [expected];
  console.log(`[cloud-rollout] dogfood ${label}: ${response.status}${body.errorCode ? ` ${body.errorCode}` : ''}`);
  assertNoSensitive(body);
  if (!allowed.includes(response.status)) throw new Error(`${label} expected ${allowed.join('/')} but got ${response.status}`);
  const cookie = response.headers.get('set-cookie')?.split(';')[0] ?? options?.cookie ?? '';
  return { response, body, cookie };
}

function validateCommercialConsumerSecrets() {
  const bootstrapSecretHash = process.env.MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256?.trim() ?? '';
  if (!/^[0-9a-f]{64}$/i.test(bootstrapSecretHash)) {
    console.error('MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256 must be a 64-character sha256 hex string.');
    process.exit(2);
  }
  if (!process.env.MEDOPL_WEBHOOK_SECRET) {
    console.error('MEDOPL_WEBHOOK_SECRET must be non-empty.');
    process.exit(2);
  }
}

async function medoplSessionBootstrap(medoplBaseUrl, context) {
  const response = await fetch(`${medoplBaseUrl}/api/session/bootstrap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', connection: 'close' },
    body: JSON.stringify(signedMedOPLBootstrapPayload(context)),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  assertNoSensitive(body);
  if (!response.ok || body.session !== 'issued') {
    throw new Error(`MedOPL session bootstrap expected 200 issued but got ${response.status}`);
  }
  const cookieLines = setCookieLines(response.headers);
  const sessionPair = cookiePairFromSetCookie(cookieLines, 'medopl_session');
  const csrfPair = cookiePairFromSetCookie(cookieLines, 'medopl_csrf');
  if (!sessionPair || !csrfPair) {
    throw new Error('MedOPL session bootstrap did not return session and csrf cookies');
  }
  return {
    cookieHeader: `${sessionPair}; ${csrfPair}`,
    csrfToken: decodeURIComponent(csrfPair.slice('medopl_csrf='.length)),
  };
}

function signedMedOPLBootstrapPayload({ tenantId, portalUserId, workspaceId }) {
  const nonce = `opl-webui-commercial-${hashPublicRef(`${workspaceId}:${Date.now()}`)}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const bootstrapSecretHash = process.env.MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256;
  return {
    tenantId,
    userId: portalUserId,
    workspaceId,
    nonce,
    expiresAt,
    signature: createHash('sha256')
      .update([tenantId, portalUserId, workspaceId, nonce, expiresAt, bootstrapSecretHash].map((item) => String(item || '').trim()).join(':'))
      .digest('hex'),
  };
}

async function medoplFetch(medoplBaseUrl, path, options, label, expected = 200) {
  const headers = { connection: 'close' };
  if (options?.body) headers['content-type'] = 'application/json';
  if (options?.identity) Object.assign(headers, medoplIdentityHeaders(options.identity));
  if (options?.session) {
    headers.cookie = options.session.cookieHeader;
    if ((options.method ?? 'GET') !== 'GET') headers['X-MedOPL-CSRF'] = options.session.csrfToken;
  }
  if (options?.webhookSecret) headers['X-MedOPL-Webhook-Secret'] = options.webhookSecret;
  const response = await fetch(`${medoplBaseUrl}${path}`, {
    method: options?.method ?? 'GET',
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  const allowed = Array.isArray(expected) ? expected : [expected];
  console.log(`[cloud-rollout] commercial MedOPL ${label}: ${response.status}${body.errorCode ? ` ${body.errorCode}` : ''}`);
  assertNoSensitive(body);
  assertNoCommercialTruthLeak(body);
  if (!allowed.includes(response.status)) throw new Error(`${label} expected ${allowed.join('/')} but got ${response.status}`);
  return { response, body };
}

function medoplIdentityHeaders({ tenantId, portalUserId, workspaceId }) {
  return {
    'X-MedOPL-Tenant-ID': String(tenantId || '').trim(),
    'X-MedOPL-User-ID': String(portalUserId || '').trim(),
    'X-MedOPL-Workspace-ID': String(workspaceId || '').trim(),
  };
}

function setCookieLines(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const joined = headers.get('set-cookie') || '';
  return joined.split(/,(?=\s*(?:medopl|opl)_(?:session|csrf)=)/).map((item) => item.trim()).filter(Boolean);
}

function cookiePairFromSetCookie(lines, name) {
  const prefix = `${name}=`;
  const line = lines.find((item) => item.startsWith(prefix));
  return line ? line.split(';')[0] : '';
}

function requireEnv(name) {
  if (!process.env[name]) {
    console.error(`Missing required ${name}. Run without --commercial-consumer-e2e for dry-run output.`);
    process.exit(2);
  }
}

function validateDogfoodCredentials() {
  const email = process.env.OPL_DOGFOOD_EMAIL?.trim() ?? '';
  const password = process.env.OPL_DOGFOOD_PASSWORD ?? '';
  if (!isValidDogfoodEmail(email)) {
    console.error('OPL_DOGFOOD_EMAIL must be a valid email address.');
    process.exit(2);
  }
  if (password.length === 0) {
    console.error('OPL_DOGFOOD_PASSWORD must be non-empty.');
    process.exit(2);
  }
}

function isValidDogfoodEmail(email) {
  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@') || at === email.length - 1) return false;
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} mismatch`);
}

function requiredString(source, field, label) {
  const value = source?.[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} missing ${field}`);
  }
  return value.trim();
}

function firstTask(body, conversationId) {
  const tasks = Array.isArray(body?.tasks) ? body.tasks : [];
  const task = tasks.find((item) => item.conversationId === conversationId) || tasks[0];
  if (!task) throw new Error('WebUI task history did not return a task');
  if (task.webuiArtifactBody !== 'forbidden' || task.webuiStorageTruth !== 'forbidden') {
    throw new Error('WebUI task history boundary mismatch');
  }
  return task;
}

function hashPublicRef(value = '') {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function assertNoSensitive(value) {
  const text = JSON.stringify(value);
  for (const sensitive of [
    process.env.OPL_DOGFOOD_API_KEY,
    process.env.OPL_DOGFOOD_PASSWORD,
    process.env.MEDOPL_WEBHOOK_SECRET,
    process.env.MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256,
  ]) {
    if (sensitive && text.includes(sensitive)) throw new Error('dogfood response contains sensitive material');
  }
  assertNoUnsafeFields(value);
}

function assertNoCommercialTruthLeak(value) {
  const text = JSON.stringify(stripAllowedCommercialBoundaryFields(value));
  if (/artifactBody|artifact_body|runtimeToken|launchToken|storageObjectKey|objectKey|signedUrl|paymentTruth|billingTruth|rawProviderKey|providerApiKey|kubeconfig/i.test(text)) {
    throw new Error('commercial consumer payload contains forbidden truth material');
  }
}

function stripAllowedCommercialBoundaryFields(value) {
  if (Array.isArray(value)) return value.map(stripAllowedCommercialBoundaryFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => ![
      'webuiArtifactBody',
      'webuiDomainTruth',
      'webuiStorageMutation',
      'webuiBillingSourceOfTruth',
      'webuiPaymentMutation',
      'webuiStorageTruth',
    ].includes(key))
    .map(([key, item]) => [key, stripAllowedCommercialBoundaryFields(item)]));
}

function assertNoUnsafeFields(value) {
  if (Array.isArray(value)) {
    for (const item of value) assertNoUnsafeFields(item);
    return;
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && /postgres:\/\//i.test(value)) throw new Error('dogfood response contains unsafe fields');
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (/rawApiKey|encryptedApiKey|passwordHash/i.test(key)) throw new Error('dogfood response contains unsafe fields');
    if (/password/i.test(key) && typeof nested !== 'boolean') throw new Error('dogfood response contains unsafe fields');
    assertNoUnsafeFields(nested);
  }
}
