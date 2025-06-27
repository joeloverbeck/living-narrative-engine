import ContentDependencyValidator from '../../../../src/initializers/services/contentDependencyValidator.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

let logger;

beforeEach(() => {
  logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
});

describe('ContentDependencyValidator', () => {
  it('warns and exits when repository is missing methods', async () => {
    const validator = new ContentDependencyValidator({
      logger,
      gameDataRepository: {},
    });

    await validator.validate('world');

    expect(logger.warn).toHaveBeenCalledWith(
      'Content dependency validation skipped: gameDataRepository lacks required methods.'
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs error for instance referencing missing definition', async () => {
    const repo = {
      getAllEntityInstanceDefinitions: jest
        .fn()
        .mockReturnValue([
          { instanceId: 'inst1', definitionId: 'def:missing' },
        ]),
      getAllEntityDefinitions: jest
        .fn()
        .mockReturnValue([{ id: 'def:exists' }]),
      getWorld: jest.fn().mockReturnValue({ instances: [] }),
    };

    const validator = new ContentDependencyValidator({
      logger,
      gameDataRepository: repo,
    });
    await validator.validate('world');

    expect(logger.error).toHaveBeenCalledWith(
      "Content Validation: Instance 'inst1' references missing definition 'def:missing'."
    );
  });

  it('logs error when exit target is not spawned', async () => {
    const repo = {
      getAllEntityInstanceDefinitions: jest.fn().mockReturnValue([
        { instanceId: 'inst1', definitionId: 'def:exists' },
        { instanceId: 'target1', definitionId: 'def:exists' },
      ]),
      getAllEntityDefinitions: jest.fn().mockReturnValue([
        {
          id: 'def:exists',
          components: { 'core:exits': [{ target: 'target1' }] },
        },
      ]),
      getWorld: jest
        .fn()
        .mockReturnValue({ instances: [{ instanceId: 'inst1' }] }),
    };

    const validator = new ContentDependencyValidator({
      logger,
      gameDataRepository: repo,
    });
    await validator.validate('testWorld');

    expect(logger.error).toHaveBeenCalledWith(
      "Content Validation: Exit target 'target1' in definition 'def:exists' is not spawned in world 'testWorld'."
    );
  });
});
