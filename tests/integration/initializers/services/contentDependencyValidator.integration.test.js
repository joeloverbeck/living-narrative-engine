import { beforeEach, describe, expect, it } from '@jest/globals';

import ContentDependencyValidator from '../../../../src/initializers/services/contentDependencyValidator.js';
import { GameDataRepository } from '../../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';

class RecordingLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  #record(target, values) {
    const message = values
      .map((value) =>
        typeof value === 'string' ? value : JSON.stringify(value)
      )
      .join(' ')
      .trim();
    target.push(message);
  }

  debug(...values) {
    this.#record(this.debugMessages, values);
  }

  info(...values) {
    this.#record(this.infoMessages, values);
  }

  warn(...values) {
    this.#record(this.warnMessages, values);
  }

  error(...values) {
    this.#record(this.errorMessages, values);
  }
}

describe('ContentDependencyValidator integration', () => {
  let logger;
  let registry;
  let repository;

  beforeEach(() => {
    logger = new RecordingLogger();
    registry = new InMemoryDataRegistry({ logger });
    repository = new GameDataRepository(registry, logger);
  });

  it('flags missing definitions and inconsistent exit references using the real repository stack', async () => {
    registry.store('entityDefinitions', 'core:room', {
      id: 'core:room',
      components: {
        'locations:exits': [
          { target: 'instance:doorA', blocker: 'instance:guardA' },
          { target: 'instance:missing', blocker: 'instance:ghost' },
          {},
          { target: 'instance:roomA', blocker: 'instance:roomA' },
          null,
        ],
      },
    });
    registry.store('entityDefinitions', 'core:door', {
      id: 'core:door',
      components: {},
    });
    registry.store('entityDefinitions', 'core:guard', {
      id: 'core:guard',
      components: {},
    });
    registry.store('entityDefinitions', 'core:invalidExits', {
      id: 'core:invalidExits',
      components: {
        'locations:exits': 'not-an-array',
      },
    });

    registry.store('entityInstances', 'instance:roomA', {
      instanceId: 'instance:roomA',
      definitionId: 'core:room',
    });
    registry.store('entityInstances', 'instance:doorA', {
      instanceId: 'instance:doorA',
      definitionId: 'core:door',
    });
    registry.store('entityInstances', 'instance:guardA', {
      instanceId: 'instance:guardA',
      definitionId: 'core:guard',
    });
    registry.store('entityInstances', 'instance:missingDef', {
      instanceId: 'instance:missingDef',
      definitionId: 'core:missing',
    });
    registry.store('entityInstances', 'instance:invalid', {
      instanceId: 'instance:invalid',
      definitionId: 'core:invalidExits',
    });

    registry.store('worlds', 'world:test', {
      id: 'world:test',
      instances: [
        { instanceId: 'instance:roomA' },
        { instanceId: 'instance:missingDef' },
        { instanceId: 'instance:invalid' },
        { instanceId: 12345 },
      ],
    });

    const validator = new ContentDependencyValidator({
      gameDataRepository: repository,
      logger,
    });

    await validator.validate('world:test');

    expect(
      logger.debugMessages.filter((message) =>
        message.includes(
          'ContentDependencyValidator: Validating content dependencies...'
        )
      ).length
    ).toBe(1);
    expect(
      logger.debugMessages.filter((message) =>
        message.includes(
          'ContentDependencyValidator: Content dependency validation complete.'
        )
      ).length
    ).toBe(1);

    expect(logger.errorMessages).toEqual(
      expect.arrayContaining([
        "Content Validation: Instance 'instance:missingDef' references missing definition 'core:missing'.",
        "Content Validation: Exit target 'instance:doorA' in definition 'core:room' is not spawned in world 'world:test'.",
        "Content Validation: Exit blocker 'instance:guardA' in definition 'core:room' is not spawned in world 'world:test'.",
        "Content Validation: Exit target 'instance:missing' in definition 'core:room' has no corresponding instance data.",
        "Content Validation: Exit blocker 'instance:ghost' in definition 'core:room' has no corresponding instance data.",
      ])
    );
  });

  it('gracefully skips validation when repository configuration is incomplete', async () => {
    const defaultValidator = new ContentDependencyValidator();
    await expect(
      defaultValidator.validate('world:test')
    ).resolves.toBeUndefined();

    const validator = new ContentDependencyValidator({
      gameDataRepository: {
        getAllEntityInstanceDefinitions: null,
      },
      logger,
    });

    await validator.validate('world:test');

    expect(logger.warnMessages).toContain(
      'Content dependency validation skipped: gameDataRepository lacks required methods.'
    );
    expect(logger.errorMessages).toEqual([]);
    expect(
      logger.debugMessages.filter((message) =>
        message.includes(
          'ContentDependencyValidator: Content dependency validation complete.'
        )
      ).length
    ).toBe(0);
  });

  it('handles worlds without instance listings by leaving the spawn set empty', async () => {
    registry.store('entityDefinitions', 'core:simple', {
      id: 'core:simple',
      components: {
        'locations:exits': [],
      },
    });
    registry.store('entityInstances', 'instance:simple', {
      instanceId: 'instance:simple',
      definitionId: 'core:simple',
    });
    registry.store('worlds', 'world:empty', { id: 'world:empty' });

    const validator = new ContentDependencyValidator({
      gameDataRepository: repository,
      logger,
    });

    await validator.validate('world:empty');

    expect(
      logger.debugMessages.filter((message) =>
        message.includes(
          'ContentDependencyValidator: Validating content dependencies...'
        )
      ).length
    ).toBe(1);
    expect(
      logger.debugMessages.filter((message) =>
        message.includes(
          'ContentDependencyValidator: Content dependency validation complete.'
        )
      ).length
    ).toBe(1);
    expect(logger.errorMessages).toEqual([]);
  });
});
