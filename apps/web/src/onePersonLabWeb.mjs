export {
  FIGMA_MAKE_SOURCE,
  FIXED_BASE_URL,
  LIGHTWEIGHT_MARKERS,
  MEDOPL_DEEP_LINK,
  CAPABILITY_MARKER_SEMANTICS,
  OPL_CAPABILITY_MANIFEST,
  RESEARCH_RESULT_SECTIONS,
  RESEARCH_TASK_INTENTS,
  RUNTIME_REQUIRED_MARKERS,
  accountState,
  chatStateForResult,
  chatStateForPrompt,
  createOnePersonLabViewModel,
  loadOnePersonLabWebState,
  loginAccount,
  logoutAccount,
  registerAccount,
  researchResultForChat,
  requiresRuntimeGate,
  runtimeTaskCardForPrompt,
  saveAPIKey,
  sendChatMessage,
  viewFromHash,
} from './onePersonLabWebState.mjs';

import { initOnePersonLabWeb } from './onePersonLabWebDom.mjs';

if (typeof document !== 'undefined') {
  initOnePersonLabWeb();
}
