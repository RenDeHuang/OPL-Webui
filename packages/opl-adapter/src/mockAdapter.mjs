import { evaluateCommand, listAllowedCommands } from './commandPolicy.mjs';

export class MockOplAdapter {
  constructor(policy) {
    this.policy = policy;
  }

  listCapabilities() {
    return listAllowedCommands(this.policy);
  }

  async run(command) {
    const decision = evaluateCommand(command, this.policy);
    if (!decision.allowed) {
      return {
        ok: false,
        command,
        errorCode: 'OPL_COMMAND_DENIED',
        message: decision.reason
      };
    }

    return {
      ok: true,
      command,
      policyId: decision.policyId,
      mode: decision.mode,
      stdout: JSON.stringify({
        adapter: 'mock',
        policyId: decision.policyId,
        command
      }),
      stderr: ''
    };
  }
}
