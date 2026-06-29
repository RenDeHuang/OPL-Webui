import { MEDOPL_DEEP_LINK } from '../onePersonLabWebState.mjs';

export function renderAccountPopover(state, { escapeHTML }) {
  const providerStatus = state.view.provider.apiKeyConfigured ? `已绑定：${state.view.provider.maskedKey}` : '未绑定';
  return `
    <aside class="account-popover" id="account-popover" data-account-popover data-figma-slice="figma_dialog_sheet_projection_slice">
      <header><span>Account</span><button type="button" data-account-popover-close aria-label="关闭账号弹层">x</button></header>
      <dl>
        <div><dt>登录状态</dt><dd data-session-status>${escapeHTML(state.view.session.email || '未登录')}</dd></div>
        <div><dt>API Key 绑定状态</dt><dd data-provider-status>${escapeHTML(providerStatus)}</dd></div>
      </dl>
      <form data-provider-form>
        <label for="api-key">API Key</label>
        <input id="api-key" name="apiKey" type="password" autocomplete="off" placeholder="sk-...">
        <p>只保存到 Go control plane；页面只显示 masked key，不回显 raw API Key。</p>
        <button class="primary-button full" type="submit" data-save-key-button>保存/更新 API Key</button>
        <button class="secondary-button full" type="button" data-billing-summary-open>readonly commercial projection</button>
        <button class="text-button full" type="button" data-logout-button>退出登录</button>
        <p class="form-message" data-settings-message role="status"></p>
      </form>
    </aside>`;
}

export function renderBillingSummary(state) {
  const quota = state.view.billingSummary.quota || {};
  return `
    <div class="sheet-backdrop" data-billing-close></div>
    <aside class="billing-panel" data-surface="billing_summary_projection">
      <header><div><h2>用量概览</h2><p>只读投影 · commercial authority 由 MedOPL 持有</p></div><button type="button" data-billing-close aria-label="关闭用量概览">x</button></header>
      <dl>
        <div><dt>API key / quota projection</dt><dd>${Number(quota.used || 0)} / ${Number(quota.limit || 0)}</dd></div>
        <div><dt>external capability handoff</dt><dd><a href="${MEDOPL_DEEP_LINK}/billing">MedOPL</a></dd></div>
      </dl>
    </aside>`;
}

export function renderAPIKeyDialog() {
  const open = document.body.dataset.apiKeyDialogState === 'open';
  return `
    <aside class="api-key-dialog" data-api-key-dialog data-api-key-dialog-state="${open ? 'open' : 'closed'}" role="dialog" aria-modal="true" aria-labelledby="api-key-dialog-title" data-figma-slice="figma_dialog_sheet_projection_slice" ${open ? '' : 'hidden'}>
      <div class="api-key-dialog-panel">
        <span>API Key</span>
        <h2 id="api-key-dialog-title">发送前需要绑定 API Key</h2>
        <p>绑定后即可发送普通聊天；页面不会回显 raw API Key。</p>
        <button class="primary-button full" type="button" data-api-key-dialog-primary>去绑定</button>
        <button class="text-button full" type="button" data-api-key-dialog-close>稍后处理</button>
      </div>
    </aside>`;
}
