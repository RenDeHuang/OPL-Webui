export {
  FIGMA_MAKE_SOURCE,
  FIXED_BASE_URL,
  MEDOPL_DEEP_LINK,
  OPL_CAPABILITY_MANIFEST,
  accountState,
  chatStateForResult,
  createOnePersonLabViewModel,
  loadOnePersonLabWebState,
  loginAccount,
  logoutAccount,
  registerAccount,
  saveAPIKey,
  sendChatMessage,
  viewFromHash,
} from './onePersonLabWebState.mjs';

import { initOnePersonLabWeb } from './onePersonLabWebDom.mjs';

if (typeof document !== 'undefined') {
  initOnePersonLabWeb();
}
