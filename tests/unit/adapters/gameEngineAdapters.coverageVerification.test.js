import { describe, it, expect, jest } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import GameEngineSaveAdapter from '../../../src/adapters/GameEngineSaveAdapter.js';

const getCoverageEntry = (ending) => {
  const coverage = globalThis.__coverage__;
  if (!coverage) {
    return null;
  }

  const entry = Object.entries(coverage).find(([filename]) =>
    filename.endsWith(ending)
  );

  return entry ? entry[1] : null;
};

describe('GameEngine adapters coverage verification', () => {
  it('touches every statement in GameEngineLoadAdapter', async () => {
    const engine = {
      loadGame: jest.fn().mockResolvedValue({ ok: true }),
    };

    const adapter = new GameEngineLoadAdapter(engine);

    await expect(adapter.load('slot-1')).resolves.toEqual({ ok: true });
    expect(engine.loadGame).toHaveBeenCalledTimes(1);
    expect(engine.loadGame).toHaveBeenCalledWith('slot-1');

    const fileCoverage = getCoverageEntry(
      '/src/adapters/GameEngineLoadAdapter.js'
    );
    if (fileCoverage) {
      Object.values(fileCoverage.s).forEach((hits) =>
        expect(hits).toBeGreaterThan(0)
      );
      Object.values(fileCoverage.f).forEach((hits) =>
        expect(hits).toBeGreaterThan(0)
      );
    }
  });

  it('touches every statement in GameEngineSaveAdapter', async () => {
    const engine = {
      triggerManualSave: jest.fn().mockResolvedValue('saved'),
    };

    const adapter = new GameEngineSaveAdapter(engine);

    await expect(adapter.save('slot-2', 'backup')).resolves.toBe('saved');
    expect(engine.triggerManualSave).toHaveBeenCalledTimes(1);
    expect(engine.triggerManualSave).toHaveBeenCalledWith('backup', 'slot-2');

    const fileCoverage = getCoverageEntry(
      '/src/adapters/GameEngineSaveAdapter.js'
    );
    if (fileCoverage) {
      Object.values(fileCoverage.s).forEach((hits) =>
        expect(hits).toBeGreaterThan(0)
      );
      Object.values(fileCoverage.f).forEach((hits) =>
        expect(hits).toBeGreaterThan(0)
      );
    }
  });
});
