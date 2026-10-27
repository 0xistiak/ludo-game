import { describe, it, expect } from 'vitest';
import { runOnlineFlowCheck } from './online-flow';

describe('Online Multiplayer Route Flow Check', () => {
  it('runs complete create -> join -> ready -> roll -> move simulation with all security validations', async () => {
    const result = await runOnlineFlowCheck();
    expect(result.success).toBe(true);
  }, 30000);
});
