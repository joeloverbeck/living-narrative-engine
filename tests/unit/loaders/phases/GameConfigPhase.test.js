import { jest } from '@jest/globals';
import GameConfigPhase from '../../../../src/loaders/phases/GameConfigPhase.js';
import { createLoadContext } from '../../../../src/loaders/LoadContext.js';

describe('GameConfigPhase', () => {
  it('should create a new context without mutating the previous one', async () => {
    const gameConfigLoader = {
      loadConfig: jest.fn().mockResolvedValue(['core']),
    };
    const logger = { info: jest.fn(), debug: jest.fn(), error: jest.fn() };
    const registry = {};
    const ctx = createLoadContext({ worldName: 'test', registry });
    Object.freeze(ctx.requestedMods);
    Object.freeze(ctx.totals);
    const phase = new GameConfigPhase({ gameConfigLoader, logger });
    const result = await phase.execute(ctx);
    expect(result).not.toBe(ctx);
    expect(ctx.requestedMods).toEqual([]);
    expect(result.requestedMods).toEqual(['core']);
  });
});
