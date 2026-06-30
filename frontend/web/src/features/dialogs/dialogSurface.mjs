import { MEDOPL_DEEP_LINK } from '../../product/catalog.mjs';

export function renderAccountPopover(state, { escapeHTML }) {
  const isConfigured = Boolean(state.view.provider.apiKeyConfigured);
  const providerStatus = isConfigured ? `已绑定 · ${state.view.provider.maskedKey || '已脱敏'} · 更换` : '未绑定';
  const shouldShowForm = !isConfigured || state.showApiKeyChange;
  return `
    <aside class="account-popover" id="account-popover" data-account-popover data-figma-slice="figma_dialog_sheet_projection_slice">
      <header><span>账号设置</span><button type="button" data-account-popover-close aria-label="关闭账号弹层">x</button></header>
      <dl>
        <div><dt>登录状态</dt><dd data-session-status>${escapeHTML(state.view.session.email || '未登录')}</dd></div>
        <div><dt>模型服务</dt><dd data-provider-status data-provider-bound-summary>${escapeHTML(providerStatus)}</dd></div>
      </dl>
      ${isConfigured ? '<button class="secondary-button full" type="button" data-provider-change-key>更换 API Key</button>' : ''}
      <form data-provider-form ${shouldShowForm ? '' : 'hidden'}>
        <label for="api-key">API Key</label>
        <input id="api-key" name="apiKey" type="password" autocomplete="off" placeholder="sk-...">
        <p>密钥只保存在服务器，不会在页面明文显示。</p>
        <button class="primary-button full" type="submit" data-save-key-button>保存/更新 API Key</button>
        ${isConfigured ? '<button class="text-button full" type="button" data-provider-change-cancel>取消更换</button>' : ''}
        <p class="form-message" data-settings-message role="status"></p>
      </form>
      <button class="secondary-button full" type="button" data-billing-summary-open>用量与额度</button>
      <button class="text-button full" type="button" data-logout-button>退出登录</button>
    </aside>`;
}

export function renderBillingSummary(state) {
  const quota = state.view.billingSummary.quota || {};
  return `
    <div class="sheet-backdrop" data-billing-close></div>
    <aside class="billing-panel" data-surface="billing_summary_projection">
      <header><div><h2>用量与额度</h2><p>只显示来自 MedOPL 的只读状态。</p></div><button type="button" data-billing-close aria-label="关闭用量概览">x</button></header>
      <dl>
        <div><dt>本月用量</dt><dd>${Number(quota.used || 0)} / ${Number(quota.limit || 0)}</dd></div>
        <div><dt>需要调整额度</dt><dd><a href="${MEDOPL_DEEP_LINK}/billing">前往 MedOPL</a></dd></div>
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
        <p>绑定后即可发送普通聊天；页面不会明文显示密钥。</p>
        <button class="primary-button full" type="button" data-api-key-dialog-primary>去绑定</button>
        <button class="text-button full" type="button" data-api-key-dialog-close>稍后处理</button>
      </div>
    </aside>`;
}
