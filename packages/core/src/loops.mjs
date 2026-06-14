export const PRODUCT_LOOPS = [
  {
    id: 'intake',
    name: 'Intake Loop',
    purpose: 'turn user intent and files into a structured OPL task'
  },
  {
    id: 'project',
    name: 'Project Loop',
    purpose: 'bind workspace files, context, members, and tenant scope'
  },
  {
    id: 'task-runtime',
    name: 'Task Runtime Loop',
    purpose: 'advance a task through queued, running, review, completed, failed, or blocked states'
  },
  {
    id: 'review',
    name: 'Review Loop',
    purpose: 'route decisions that need human approval before continuing'
  },
  {
    id: 'artifact',
    name: 'Artifact Loop',
    purpose: 'version, trace, and deliver OPL output projections'
  },
  {
    id: 'tenant',
    name: 'Tenant Loop',
    purpose: 'isolate users, quotas, audit, and provider key references'
  }
];

export const TASK_STATUSES = [
  'draft',
  'queued',
  'running',
  'needs_review',
  'completed',
  'failed',
  'blocked'
];
