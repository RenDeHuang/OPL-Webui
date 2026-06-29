import { readJSON } from '../api/controlPlaneClient.mjs';
import { createOnePersonLabViewModel } from '../state/viewModel.mjs';

export * from './catalog.mjs';
export * from '../api/controlPlaneClient.mjs';
export * from '../state/viewModel.mjs';

export async function loadOnePersonLabWebState(fetchRef = fetch, options = {}) {
  const shouldProbeSession = options.probeSession !== false;
  const shouldLoadSnapshot = options.loadSnapshot !== false;
  const session = shouldProbeSession ? await readJSON(fetchRef, '/api/session/current') : { ok: false };
  const provider = session.ok ? await readJSON(fetchRef, '/api/settings/model-provider') : { ok: false };
  const conversations = session.ok ? await readJSON(fetchRef, '/api/chat/conversations') : { conversations: [] };
  const taskHistory = session.ok ? await readJSON(fetchRef, '/api/tasks') : {};
  const commercialStatus = session.ok ? await readJSON(fetchRef, '/api/account/commercial-status') : {};
  const billingSummary = session.ok ? await readJSON(fetchRef, '/api/account/billing-summary') : {};
  const runtimeStatus = await readJSON(fetchRef, '/api/medopl/runtime/status');
  const materialsDeliverables = await readJSON(fetchRef, '/api/medopl/materials-deliverables/projection');
  const oplSnapshot = shouldLoadSnapshot ? await readJSON(fetchRef, '/api/opl/snapshot') : { ok: false };
  return createOnePersonLabViewModel({
    session,
    provider,
    conversations,
    taskHistory,
    commercialStatus,
    billingSummary,
    runtimeStatus,
    materialsDeliverables,
    oplSnapshot,
  });
}
