export const FIXED_BASE_URL = 'https://gflabtoken.cn/v1';
export const MEDOPL_DEEP_LINK = 'https://medopl.medopl.cn';
export const FIGMA_MAKE_SOURCE = '1MNO5l7PQYKZVNqQgw6DGS';
export const LIGHTWEIGHT_MARKERS = ['@科研'];
export const RUNTIME_REQUIRED_MARKERS = ['@论文', '@基金', '@综述', '@文件', '@PPT', '@书'];
export const CAPABILITY_MARKER_SEMANTICS = [
  { marker: '@科研', workflow: 'research_planning', runtimePolicy: 'ordinary_chat_fallback' },
  { marker: '@论文', workflow: 'paper_review_workflow', runtimePolicy: 'runtime_gate' },
  { marker: '@基金', workflow: 'grant_workflow', runtimePolicy: 'runtime_gate' },
  { marker: '@综述', workflow: 'review_workflow', runtimePolicy: 'runtime_gate' },
  { marker: '@文件', workflow: 'materials_refs_workflow', runtimePolicy: 'runtime_gate' },
  { marker: '@PPT', workflow: 'presentation_foundry_workflow', runtimePolicy: 'runtime_gate' },
  { marker: '@书', workflow: 'book_foundry_workflow', runtimePolicy: 'runtime_gate' },
];
export const RESEARCH_TASK_INTENTS = [
  {
    id: 'research_direction',
    label: '开题/研究方向',
    marker: '@科研',
    prompt: '@科研 帮我拆解研究方向、问题和下一步计划',
    runtimePolicy: 'ordinary_chat_fallback',
    expectedChatState: 'research_entry_selected',
    consumer: 'research_user_prompt',
  },
  {
    id: 'paper_question',
    label: '论文问题',
    marker: '@论文',
    prompt: '@论文 生成研究选题、问题拆解和证据计划',
    runtimePolicy: 'runtime_gate',
    expectedChatState: 'paper_entry_selected',
    consumer: 'research_user_prompt',
  },
  {
    id: 'grant_plan',
    label: '基金计划',
    marker: '@基金',
    prompt: '@基金 帮我拆解标书结构、研究目标和执行路径',
    runtimePolicy: 'runtime_gate',
    expectedChatState: 'grant_entry_selected',
    consumer: 'research_user_prompt',
  },
  {
    id: 'review_map',
    label: '综述地图',
    marker: '@综述',
    prompt: '@综述 帮我整理综述结构、证据线索和引用计划',
    runtimePolicy: 'runtime_gate',
    expectedChatState: 'materials_refs_pending',
    consumer: 'research_user_prompt',
  },
  {
    id: 'materials_refs',
    label: '材料线索',
    marker: '@文件',
    prompt: '@文件 整理材料引用和交付物 refs',
    runtimePolicy: 'runtime_gate',
    expectedChatState: 'materials_refs_pending',
    consumer: 'research_user_prompt',
  },
  {
    id: 'presentation_foundry',
    label: '演示/PPT',
    marker: '@PPT',
    prompt: '@PPT 规划研究演示结构、证据线和交付物 refs',
    runtimePolicy: 'runtime_gate',
    expectedChatState: 'presentation_entry_selected',
    consumer: 'research_user_prompt',
  },
  {
    id: 'book_foundry',
    label: '写书/长稿',
    marker: '@书',
    prompt: '@书 规划书稿结构、章节路线和资料 refs',
    runtimePolicy: 'runtime_gate',
    expectedChatState: 'book_entry_selected',
    consumer: 'research_user_prompt',
  },
];
export const RESEARCH_RESULT_SECTIONS = [
  {
    id: 'research_plan',
    title: '研究计划',
    fallback: '先把研究方向拆成问题、假设和可执行步骤。',
  },
  {
    id: 'evidence_refs',
    title: '证据线索',
    fallback: '继续补充材料、引用和可核查来源。',
  },
  {
    id: 'next_steps',
    title: '下一步',
    fallback: '选择一个问题进入论文、基金或综述工作流。',
  },
];
export const OPL_CAPABILITY_MANIFEST = {
  source: {
    syncMode: 'source_path_pinned_manifest',
    dynamicSync: false,
    commitPin: 'blocked_by_github_tls_timeout',
    appContract: 'github.com/gaofeng21cn/one-person-lab-app/contracts/app-product-profile.json',
    frameworkContract: 'github.com/gaofeng21cn/one-person-lab/contracts/opl-framework/domains.json',
  },
  capabilities: [
    ['科研规划', '@科研 帮我拆解研究方向、问题和下一步计划', false, 'chat'],
    ['论文/综述', '@论文 生成研究选题和证据计划', true, 'mas'],
    ['基金', '@基金 帮我拆解标书结构', true, 'mag'],
    ['材料/文件', '@文件 整理材料引用和交付物 refs', true, 'medopl'],
    ['演示/PPT', '@PPT 规划研究演示结构、证据线和交付物 refs', true, 'rca'],
    ['写书/长稿', '@书 规划书稿结构、章节路线和资料 refs', true, 'bookforge'],
    ['普通问答', '解释 OPL 如何帮助复杂知识工作', false, 'chat'],
  ],
};
