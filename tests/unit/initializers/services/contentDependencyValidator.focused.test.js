import ContentDependencyValidator from '../../../../src/initializers/services/contentDependencyValidator.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

let logger;

beforeEach(() => {
  logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
});

describe('ContentDependencyValidator', () => {
  it('constructs without dependencies', () => {
    const validator = new ContentDependencyValidator();
    expect(validator).toBeInstanceOf(ContentDependencyValidator);
  });

  it('handles null gameDataRepository gracefully', async () => {
    const validator = new ContentDependencyValidator({
      logger,
      gameDataRepository: null,
    });

    await validator.validate('world');

    expect(logger.warn).toHaveBeenCalledWith(
      'Content dependency validation skipped: gameDataRepository lacks required methods.'
    );
  });

  it('handles world definition without instances array', async () => {
    const repo = {
      getAllEntityInstanceDefinitions: jest.fn().mockReturnValue([]),
      getAllEntityDefinitions: jest.fn().mockReturnValue([]),
      getWorld: jest.fn().mockReturnValue({ name: 'testWorld' }), // No instances array
    };

    const validator = new ContentDependencyValidator({
      logger,
      gameDataRepository: repo,
    });
    await validator.validate('testWorld');

    // Should complete without errors - no instances to validate
    expect(logger.debug).toHaveBeenCalledWith(
      'ContentDependencyValidator: Content dependency validation complete.'
    );
  });

  it('handles world instances with non-string instanceId', async () => {
    const repo = {
      getAllEntityInstanceDefinitions: jest
        .fn()
        .mockReturnValue([
          { instanceId: 'validInstance', definitionId: 'def:exists' },
        ]),
      getAllEntityDefinitions: jest
        .fn()
        .mockReturnValue([{ id: 'def:exists' }]),
      getWorld: jest.fn().mockReturnValue({
        instances: [
          { instanceId: 'validInstance' },
          { instanceId: null }, // Non-string instanceId
          { instanceId: 123 }, // Non-string instanceId
          { instanceId: undefined }, // Non-string instanceId
        ],
      }),
    };

    const validator = new ContentDependencyValidator({
      logger,
      gameDataRepository: repo,
    });
    await validator.validate('testWorld');

    // Should complete without errors, ignoring non-string instanceIds
    expect(logger.debug).toHaveBeenCalledWith(
      'ContentDependencyValidator: Content dependency validation complete.'
    );
  });

  it('handles exit with null/undefined properties', async () => {
    const repo = {
      getAllEntityInstanceDefinitions: jest
        .fn()
        .mockReturnValue([{ instanceId: 'inst1', definitionId: 'def:exists' }]),
      getAllEntityDefinitions: jest.fn().mockReturnValue([
        {
          id: 'def:exists',
          components: {
            'movement:exits': [
              null, // Null exit
              {}, // Exit with no target or blocker
              { target: null }, // Null target
              { blocker: null }, // Null blocker
            ],
          },
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

    // Should not throw errors and complete validation
    expect(logger.debug).toHaveBeenCalledWith(
      'ContentDependencyValidator: Content dependency validation complete.'
    );
  });

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

  it('logs error when exit target is not spawned for definitions with instances in current world', async () => {
    const repo = {
      getAllEntityInstanceDefinitions: jest.fn().mockReturnValue([
        { instanceId: 'inst1', definitionId: 'def:exists' },
        { instanceId: 'target1', definitionId: 'def:target' },
      ]),
      getAllEntityDefinitions: jest.fn().mockReturnValue([
        {
          id: 'def:exists',
          components: { 'movement:exits': [{ target: 'target1' }] },
        },
        {
          id: 'def:target',
          components: {},
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

  it('does not validate exits for definitions without instances in current world', async () => {
    const repo = {
      getAllEntityInstanceDefinitions: jest.fn().mockReturnValue([
        { instanceId: 'inst1', definitionId: 'def:spawned' },
        { instanceId: 'target1', definitionId: 'def:target' },
      ]),
      getAllEntityDefinitions: jest.fn().mockReturnValue([
        {
          id: 'def:spawned',
          components: {},
        },
        {
          id: 'def:not_spawned',
          components: { 'movement:exits': [{ target: 'target1' }] },
        },
        {
          id: 'def:target',
          components: {},
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

    // Should not log any errors about exits for def:not_spawned since it has no instances in current world
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.stringContaining("'def:not_spawned'")
    );

    // Should complete validation successfully
    expect(logger.debug).toHaveBeenCalledWith(
      'ContentDependencyValidator: Content dependency validation complete.'
    );
  });

  it('logs error when exit target has no corresponding instance data', async () => {
    const repo = {
      getAllEntityInstanceDefinitions: jest
        .fn()
        .mockReturnValue([{ instanceId: 'inst1', definitionId: 'def:exists' }]),
      getAllEntityDefinitions: jest.fn().mockReturnValue([
        {
          id: 'def:exists',
          components: { 'movement:exits': [{ target: 'missing_target' }] },
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
      "Content Validation: Exit target 'missing_target' in definition 'def:exists' has no corresponding instance data."
    );
  });

  it('logs error when exit blocker has no corresponding instance data', async () => {
    const repo = {
      getAllEntityInstanceDefinitions: jest
        .fn()
        .mockReturnValue([{ instanceId: 'inst1', definitionId: 'def:exists' }]),
      getAllEntityDefinitions: jest.fn().mockReturnValue([
        {
          id: 'def:exists',
          components: { 'movement:exits': [{ blocker: 'missing_blocker' }] },
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
      "Content Validation: Exit blocker 'missing_blocker' in definition 'def:exists' has no corresponding instance data."
    );
  });

  it('logs error when exit blocker is not spawned in world', async () => {
    const repo = {
      getAllEntityInstanceDefinitions: jest.fn().mockReturnValue([
        { instanceId: 'inst1', definitionId: 'def:exists' },
        { instanceId: 'blocker1', definitionId: 'def:exists' },
      ]),
      getAllEntityDefinitions: jest.fn().mockReturnValue([
        {
          id: 'def:exists',
          components: { 'movement:exits': [{ blocker: 'blocker1' }] },
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
      "Content Validation: Exit blocker 'blocker1' in definition 'def:exists' is not spawned in world 'testWorld'."
    );
  });

  it('handles complex exit scenarios with multiple exits and mixed validation results', async () => {
    const repo = {
      getAllEntityInstanceDefinitions: jest.fn().mockReturnValue([
        { instanceId: 'room1', definitionId: 'def:room' },
        { instanceId: 'room2', definitionId: 'def:room' },
        { instanceId: 'door1', definitionId: 'def:door' },
      ]),
      getAllEntityDefinitions: jest.fn().mockReturnValue([
        {
          id: 'def:room',
          components: {
            'movement:exits': [
              { target: 'room2' }, // Valid: exists and spawned
              { target: 'missing_room' }, // Invalid: no instance data
              { blocker: 'door1' }, // Valid: exists and spawned
              { blocker: 'missing_door' }, // Invalid: no instance data
              { target: 'room2', blocker: 'door1' }, // Both valid
            ],
          },
        },
      ]),
      getWorld: jest.fn().mockReturnValue({
        instances: [
          { instanceId: 'room1' },
          { instanceId: 'room2' },
          { instanceId: 'door1' },
        ],
      }),
    };

    const validator = new ContentDependencyValidator({
      logger,
      gameDataRepository: repo,
    });
    await validator.validate('testWorld');

    // Should log errors for missing instances only
    expect(logger.error).toHaveBeenCalledWith(
      "Content Validation: Exit target 'missing_room' in definition 'def:room' has no corresponding instance data."
    );
    expect(logger.error).toHaveBeenCalledWith(
      "Content Validation: Exit blocker 'missing_door' in definition 'def:room' has no corresponding instance data."
    );

    // Should not log errors for valid targets/blockers
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.stringContaining("Exit target 'room2'")
    );
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.stringContaining("Exit blocker 'door1'")
    );
  });
});
