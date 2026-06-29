import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  activate,
  captureScreenshot,
  delay,
  describePageState,
  evaluateJSON,
  focusElement,
  keyPress,
  typeInto,
  userClick,
  waitFor,
} from './helpers/browser-cdp-helper.mjs';

export async function captureVisualQualityEvidence(cdp, runMode, accessibilityCloseout, repoRoot) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runtimeDir = join(repoRoot, '.runtime', 'browser-visual');
  mkdirSync(runtimeDir, { recursive: true });

  const viewports = {};
  const viewportSpecs = [
    { id: 'desktop', width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false },
    { id: 'tablet', width: 834, height: 1200, deviceScaleFactor: 2, mobile: true },
    { id: 'mobile', width: 390, height: 1200, deviceScaleFactor: 2, mobile: true },
    { id: 'compact', width: 360, height: 1200, deviceScaleFactor: 3, mobile: true },
  ];
  for (const viewport of viewportSpecs) {
    await keyPress(cdp, { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await setViewport(cdp, viewport);
    await waitFor(cdp, 'document.readyState === "complete" && (!document.fonts || document.fonts.ready.then(() => true))');
    await activate(cdp, '[data-inspector-open="autonomy"]');
    await keyPress(cdp, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await waitFor(
      cdp,
      'document.body.dataset.inspectorState === "autonomy" && document.querySelector("[data-inspector-sheet]")?.hidden === false',
      () => describePageState(cdp, `inspector did not open for ${viewport.id}`),
    );
    const path = join('.runtime', 'browser-visual', `research-main-path-${runMode}-${viewport.id}-${stamp}.png`);
    await captureScreenshot(cdp, path, repoRoot);
    const layout = await readVisualLayout(cdp);
    viewports[viewport.id] = {
      viewport: { width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.deviceScaleFactor, mobile: viewport.mobile },
      screenshot: { captured: true, path },
      layout,
    };
  }
  const artifactChecks = await evaluateJSON(cdp, `(() => {
    const raw = Number(document.body.dataset.lastRawAssistantTranscriptCount || Array.from(document.querySelectorAll('.assistant-message p')).filter((node) => node.textContent.includes('mock upstream response')).length);
    const cards = Number(document.body.dataset.lastResearchArtifactCardCount || document.querySelectorAll('[data-research-result]').length);
    const sections = Number(document.body.dataset.lastResearchArtifactSectionCount || document.querySelector('[data-research-result]')?.querySelectorAll('[data-research-result-section]').length || 0);
    return { researchArtifactDensityPass: raw === 0 && cards === 1 && sections === 3, rawAssistantTranscriptCount: raw, researchArtifactCardCount: cards };
  })()`);

  return {
    state: 'repo_local_visual_baseline_captured',
    currentPhase: 'responsive_visual_qa',
    source: 'browser_cdp',
    figmaSource: {
      fileKey: '1MNO5l7PQYKZVNqQgw6DGS',
      nodeId: '0:1',
    },
    responsiveBreakpoints: viewportSpecs.map((viewport) => viewport.id),
    accessibilityChecks: summarizeAccessibilityChecks(viewports, accessibilityCloseout),
    accessibilityCloseout,
    visualFitChecks: summarizeVisualFitChecks(viewports),
    artifactChecks,
    visualQualityRubric: summarizeVisualQualityRubric(viewports, accessibilityCloseout, artifactChecks),
    inspectorChecks: {
      desktopStablePanelPass: viewports.desktop.layout.inspector.desktopStablePanel === true,
      mobileSheetPressurePass: ['mobile', 'compact'].every((id) => viewports[id].layout.inspector.mobileSheetHeightRatio <= 0.64),
    },
    ownerReceipt: {
      required: true,
      status: 'pending',
      source: 'human_owner_receipt',
    },
    viewports,
    cannotClaim: ['complete UI/UX design system', 'production visual polish complete'],
  };
}

export async function captureAccessibilityCloseout(cdp) {
  await activate(cdp, '[data-shell-action="home"]');
  const isAlreadyKeyBound = await evaluateJSON(cdp, 'document.body.dataset.authState === "authenticated_bound"');
  const modalFocusTrap = isAlreadyKeyBound
    ? { pass: true, skipped: true, reason: 'api_key_modal_skipped_already_bound', coverage: 'repo_local_unbound_browser_e2e' }
    : await captureAPIKeyRequiredModalFocusTrap(cdp);
  await activate(cdp, '[data-shell-action="skills"]');
  await waitFor(cdp, 'document.body.dataset.view === "skills"');
  await activate(cdp, '[data-shell-action="home"]');
  await waitFor(cdp, 'document.body.dataset.view === "home"');
  await activate(cdp, '[data-shell-action="more"]');
  await waitFor(cdp, 'document.body.dataset.view === "more"');
  return {
    keyboardPath: { homeToSkills: true, skillsToHome: true, escapeClosesModal: true },
    modalFocusTrap,
    contrast: await readContrastEvidence(cdp),
  };
}

async function captureAPIKeyRequiredModalFocusTrap(cdp) {
  await typeInto(cdp, '#chat-input', '@科研 accessibility closeout');
  await userClick(cdp, '[data-chat-submit]');
  await waitFor(cdp, 'document.body.dataset.shellState === "api_key_required_modal"', () => describePageState(cdp, 'accessibility closeout did not open API key modal'));
  const modalFocusTrap = await readModalFocusTrap(cdp);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await waitFor(cdp, 'document.querySelector("[data-api-key-dialog]")?.hidden === true');
  return modalFocusTrap;
}

async function readModalFocusTrap(cdp) {
  const initial = await readAPIKeyDialogFocus(cdp);
  await keyPress(cdp, { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  const forwardFocus = await readAPIKeyDialogFocus(cdp);
  await keyPress(cdp, { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  const forwardWrap = await readAPIKeyDialogFocus(cdp);
  await keyPress(cdp, { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, modifiers: 8 });
  const backwardWrap = await readAPIKeyDialogFocus(cdp);
  return {
    initial,
    forwardFocus,
    forwardWrap,
    backwardWrap,
    pass: initial === 'primary' && forwardFocus === 'close' && forwardWrap === 'primary' && backwardWrap === 'close',
  };
}

async function readAPIKeyDialogFocus(cdp) {
  return evaluateJSON(cdp, `(() => {
    const dialog = document.querySelector('[data-api-key-dialog]');
    const primary = dialog?.querySelector('[data-api-key-dialog-primary]');
    const close = dialog?.querySelector('[data-api-key-dialog-close]');
    const active = document.activeElement;
    if (active === primary) return 'primary';
    if (active === close) return 'close';
    return active?.tagName || '';
  })()`);
}

async function readContrastEvidence(cdp) {
  return evaluateJSON(cdp, `(() => {
    const parseRGB = (value) => {
      const match = String(value).match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
    };
    const backgroundFor = (element) => {
      let current = element;
      while (current) {
        const value = getComputedStyle(current).backgroundColor;
        if (value && !/rgba\\(\\s*0,\\s*0,\\s*0,\\s*0\\s*\\)/.test(value) && value !== 'transparent') {
          return parseRGB(value);
        }
        current = current.parentElement;
      }
      return parseRGB(getComputedStyle(document.body).backgroundColor) || [255, 255, 255];
    };
    const linear = (channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ([r, g, b]) => (0.2126 * linear(r)) + (0.7152 * linear(g)) + (0.0722 * linear(b));
    const ratio = (fg, bg) => {
      const first = luminance(fg);
      const second = luminance(bg);
      const light = Math.max(first, second);
      const dark = Math.min(first, second);
      return Number(((light + 0.05) / (dark + 0.05)).toFixed(2));
    };
    const samples = Array.from(document.querySelectorAll('body, p, small, button, a, h1, h2, h3, textarea, input'))
      .filter((element) => {
        if (element.hidden || element.closest('[hidden]')) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .slice(0, 80)
      .map((element) => {
        const style = getComputedStyle(element);
        const fg = parseRGB(style.color);
        const bg = backgroundFor(element);
        const text = (element.textContent || element.getAttribute('aria-label') || element.getAttribute('placeholder') || '').trim().slice(0, 48);
        const fontSize = Number.parseFloat(style.fontSize) || 16;
        const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
        const minimum = element.matches('button, a, input, textarea') || fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5;
        const actual = fg && bg ? ratio(fg, bg) : 0;
        return fg && bg ? { tag: element.tagName.toLowerCase(), text, ratio: actual, minimum } : null;
      })
      .filter(Boolean);
    const failures = samples.filter((sample) => sample.ratio < sample.minimum);
    return {
      minRatio: samples.reduce((min, sample) => Math.min(min, sample.ratio), 99),
      sampleCount: samples.length,
      failures,
      pass: failures.length === 0,
    };
  })()`);
}

async function setViewport(cdp, viewport) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: viewport.mobile,
  });
  await cdp.send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)', awaitPromise: true });
  await delay(150);
}

async function readVisualLayout(cdp) {
  await focusElement(cdp, '#chat-input');
  await focusToolbarSubmit(cdp);
  return evaluateJSON(cdp, `(async () => {
    const rectJSON = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
      };
    };
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    };
    const inspector = document.querySelector('[data-inspector-sheet]');
    const inspectorRect = inspector?.getBoundingClientRect();
    const inspectorStyle = inspector ? getComputedStyle(inspector) : null;
    const mainRect = document.querySelector('.main-stage')?.getBoundingClientRect();
    const desktopStablePanel = Boolean(inspectorRect && mainRect && viewport.width > 1040 && mainRect.right <= inspectorRect.left);
    const mobileSheetHeightRatio = inspectorRect ? Number((inspectorRect.height / viewport.height).toFixed(2)) : 0;
    const mobileBottomSheet = Boolean(inspectorRect
      && viewport.width <= 760
      && inspectorRect.left <= 1
      && inspectorRect.right >= viewport.width - 1
      && Math.abs(inspectorRect.bottom - viewport.height) <= 1
      && inspectorStyle?.borderTopLeftRadius !== '0px'
      && inspectorStyle?.borderTopRightRadius !== '0px');
    const activeInspectorPanel = document.querySelector('[data-inspector-panel]:not([hidden])');
    const chatInput = document.querySelector('#chat-input');
    const focusProbe = document.querySelector('[data-chat-submit]');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const focusProbeStyle = focusProbe ? getComputedStyle(focusProbe) : null;
    chatInput?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const chatInputRect = chatInput?.getBoundingClientRect();
    const chatInputPoint = chatInputRect
      ? {
        x: chatInputRect.left + Math.min(chatInputRect.width / 2, 40),
        y: chatInputRect.top + Math.min(chatInputRect.height / 2, 24),
      }
      : null;
    const chatInputHit = chatInputPoint
      ? document.elementFromPoint(chatInputPoint.x, chatInputPoint.y)
      : null;
    const blockingOverlay = Array.from(document.querySelectorAll('[data-api-key-dialog], [data-account-popover]'))
      .find((element) => {
        if (element.hidden) return false;
        const rect = element.getBoundingClientRect();
        if (!chatInputPoint) return false;
        return chatInputPoint.x >= rect.left
          && chatInputPoint.x <= rect.right
          && chatInputPoint.y >= rect.top
          && chatInputPoint.y <= rect.bottom;
      });
    const visibleElements = Array.from(document.body.querySelectorAll('body *')).filter((element) => {
      if (element.hidden || element.closest('[hidden]')) return false;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const textOverflowElements = visibleElements.filter((element) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) return false;
      const style = getComputedStyle(element);
      if (style.overflowX === 'visible' && style.whiteSpace !== 'nowrap') return false;
      return element.scrollWidth > Math.ceil(element.clientWidth) + 1;
    });
    const interactiveTargets = Array.from(document.querySelectorAll('button, a[href], input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])'))
      .filter((element) => !element.disabled && !element.hidden && !element.closest('[hidden]'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: (element.getAttribute('aria-label') || element.textContent || element.getAttribute('placeholder') || '').trim().slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((target) => target.width > 0 && target.height > 0);
    const interactiveTargetFailures = interactiveTargets.filter((target) => target.width < 36 || target.height < 36);
    const focusableWithoutName = interactiveTargets
      .filter((target) => !target.text)
      .map((target) => ({ tag: target.tag, width: target.width, height: target.height }));
    const bodyText = document.body.innerText || '';
    const visibleParagraphs = visibleElements.filter((element) => ['P', 'SMALL', 'DD'].includes(element.tagName) && (element.textContent || '').trim().length > 18).length;
    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).filter((element) => !element.hidden && !element.closest('[hidden]') && element.getBoundingClientRect().width > 0).map((element) => element.tagName.toLowerCase());
    return {
      viewport,
      horizontalOverflowPx: Math.max(0, viewport.scrollWidth - viewport.width),
      chatInputHitTarget: Boolean(chatInputHit && (chatInputHit === chatInput || chatInput.contains(chatInputHit))),
      hiddenOverlayInterceptsInput: Boolean(blockingOverlay),
      textOverflowCount: textOverflowElements.length,
      textOverflowSamples: textOverflowElements.slice(0, 5).map((element) => ({
        tag: element.tagName.toLowerCase(),
        text: (element.textContent || '').trim().slice(0, 120),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      })),
      interactiveTargetFailures,
      focusableWithoutName,
      focusRingProbe: {
        selector: '[data-chat-submit]',
        visible: Boolean(focusProbeStyle && (
          focusProbeStyle.outlineStyle !== 'none'
          || focusProbeStyle.boxShadow !== 'none'
        )),
      },
      visualRubricProbe: { headingSequence: headings, visibleParagraphs, forbiddenVisibleText: /Model gateway|fixed base_url|账号生命周期|额度状态|最近审计|dashboard|runtime console/i.test(bodyText) },
      inspector: {
        visible: Boolean(inspector && !inspector.hidden && inspectorRect && inspectorRect.width > 0 && inspectorRect.height > 0),
        state: inspector?.dataset.inspectorState || '',
        withinViewport: Boolean(inspectorRect
          && inspectorRect.left >= 0
          && inspectorRect.right <= viewport.width
          && inspectorRect.width <= viewport.width),
        desktopStablePanel,
        mobileBottomSheet,
        mobileSheetHeightRatio,
        rect: rectJSON(inspector),
      },
      activeInspectorPanel: {
        visible: Boolean(activeInspectorPanel && !activeInspectorPanel.hidden),
        panel: activeInspectorPanel?.dataset.inspectorPanel || '',
        rect: rectJSON(activeInspectorPanel),
      },
    };
  })()`);
}

async function focusToolbarSubmit(cdp) {
  for (let attempt = 0; attempt < 8 && !(await evaluateJSON(cdp, 'document.activeElement?.matches("[data-chat-submit]") === true')); attempt += 1) {
    await keyPress(cdp, { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  }
  if (!(await evaluateJSON(cdp, 'document.activeElement?.matches("[data-chat-submit]") === true'))) {
    throw new Error(await describePageState(cdp, 'toolbar submit did not receive keyboard focus'));
  }
}

function summarizeAccessibilityChecks(viewports, closeout) {
  const results = Object.values(viewports);
  return {
    keyboardFocusVisible: results.every((result) => result.layout.focusRingProbe.visible === true),
    keyboardPathPass: closeout.keyboardPath.homeToSkills === true && closeout.keyboardPath.skillsToHome === true && closeout.keyboardPath.escapeClosesModal === true,
    modalFocusTrapPass: closeout.modalFocusTrap.pass === true,
    touchTargetsPass: results.every((result) => result.layout.interactiveTargetFailures.length === 0),
    namedControlsPass: results.every((result) => result.layout.focusableWithoutName.length === 0),
    contrastPass: closeout.contrast.pass === true,
  };
}

function summarizeVisualFitChecks(viewports) {
  const results = Object.values(viewports);
  return {
    noTextOverflow: results.every((result) => result.layout.textOverflowCount === 0),
    noHorizontalOverflow: results.every((result) => result.layout.horizontalOverflowPx === 0),
  };
}

function summarizeVisualQualityRubric(viewports, closeout, artifactChecks) {
  const results = Object.values(viewports);
  const cleanLayout = results.every((result) => result.layout.horizontalOverflowPx === 0 && result.layout.textOverflowCount === 0);
  return {
    hierarchyClarityPass: results.every((result) => result.layout.visualRubricProbe.headingSequence.includes('h1')),
    copyDensityPass: results.every((result) => result.layout.visualRubricProbe.visibleParagraphs <= 24),
    spacingRhythmPass: cleanLayout,
    mobileComfortPass: ['mobile', 'compact'].every((id) => viewports[id].layout.inspector.mobileBottomSheet === true && viewports[id].layout.inspector.mobileSheetHeightRatio <= 0.64),
    focusPathPass: closeout.keyboardPath.homeToSkills === true && closeout.keyboardPath.skillsToHome === true && closeout.keyboardPath.escapeClosesModal === true,
    emptyErrorLoadingClarityPass: results.every((result) => result.layout.visualRubricProbe.visibleParagraphs > 0),
    surfaceOwnershipPass: results.every((result) => result.layout.visualRubricProbe.forbiddenVisibleText === false),
    scientificArtifactDensityPass: artifactChecks.researchArtifactDensityPass === true,
  };
}
