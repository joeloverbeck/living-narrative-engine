import { describe, it, expect } from '@jest/globals';
import { GraphIntegrityValidator } from '../../../src/anatomy/graphIntegrityValidator.js';
import { ValidationRuleChain } from '../../../src/anatomy/validation/validationRuleChain.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class RecordingLogger {
  constructor() {
    this.debugMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, context) {
    this.debugMessages.push({ message, context });
  }

  warn(message, context) {
    this.warnMessages.push({ message, context });
  }

  error(message, context) {
    this.errorMessages.push({ message, context });
  }
}

class MapBackedEntityManager {
  constructor(entities) {
    this.entities = entities;
  }

  getComponentData(entityId, componentId) {
    const entity = this.entities.get(entityId);
    return entity ? entity[componentId] : undefined;
  }

  getAllComponentTypesForEntity(entityId) {
    const entity = this.entities.get(entityId);
    return entity ? Object.keys(entity) : [];
  }
}

describe('GraphIntegrityValidator catastrophic coverage', () => {
  it('logs warnings when validation passes but emits advisory issues', async () => {
    const entities = new Map([
      [
        'rootA',
        {
          'anatomy:part': { subType: 'torso' },
          'anatomy:sockets': { sockets: [] },
          'core:name': { text: 'Root A' },
        },
      ],
      [
        'rootB',
        {
          'anatomy:part': { subType: 'torso' },
          'anatomy:sockets': { sockets: [] },
          'core:name': { text: 'Root B' },
        },
      ],
    ]);

    const logger = new RecordingLogger();
    const validator = new GraphIntegrityValidator({
      entityManager: new MapBackedEntityManager(entities),
      logger,
    });

    const result = await validator.validateGraph(
      ['rootA', 'rootB'],
      {},
      new Set()
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      expect.stringContaining('Multiple root entities found: rootA, rootB'),
    ]);
    expect(logger.warnMessages).toEqual([
      expect.objectContaining({
        message: expect.stringContaining('Validation passed with 1 warnings'),
      }),
    ]);
  });

  it('translates unexpected rule chain failures into system issues and logs errors', async () => {
    const entities = new Map([
      [
        'root',
        {
          'anatomy:part': { subType: 'torso' },
          'anatomy:sockets': { sockets: [] },
          'core:name': { text: 'Root' },
        },
      ],
    ]);

    const logger = new RecordingLogger();
    const validator = new GraphIntegrityValidator({
      entityManager: new MapBackedEntityManager(entities),
      logger,
    });

    const originalExecute = ValidationRuleChain.prototype.execute;
    ValidationRuleChain.prototype.execute = async () => {
      throw new Error('rule chain failure');
    };

    let result;
    try {
      result = await validator.validateGraph(['root'], {}, new Set());
    } finally {
      ValidationRuleChain.prototype.execute = originalExecute;
    }

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Validation error: rule chain failure');
    expect(logger.errorMessages.some(({ message }) =>
      message.includes('Unexpected error during validation')
    )).toBe(true);
    expect(logger.errorMessages.some(({ message }) =>
      message.includes('Validation failed with 1 errors')
    )).toBe(true);
  });

  it('requires real entity manager and logger dependencies', () => {
    const logger = new RecordingLogger();

    expect(
      () => new GraphIntegrityValidator({ logger })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new GraphIntegrityValidator({
          entityManager: new MapBackedEntityManager(new Map()),
        })
    ).toThrow(InvalidArgumentError);
  });
});
