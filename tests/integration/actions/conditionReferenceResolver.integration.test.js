import { describe, it, beforeEach, expect } from '@jest/globals';

import { resolveReferences } from '../../../src/actions/validation/conditionReferenceResolver.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';

class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message) {
    this.debugMessages.push(message);
  }

  info(message) {
    this.infoMessages.push(message);
  }

  warn(message) {
    this.warnMessages.push(message);
  }

  error(message) {
    this.errorMessages.push(message);
  }
}

describe('conditionReferenceResolver integration', () => {
  /** @type {InMemoryDataRegistry} */
  let registry;
  /** @type {GameDataRepository} */
  let repository;
  /** @type {TestLogger} */
  let logger;

  const storeCondition = (id, logic) => {
    registry.store('conditions', id, { id, logic });
  };

  beforeEach(() => {
    logger = new TestLogger();
    registry = new InMemoryDataRegistry({ logger });
    repository = new GameDataRepository(registry, logger);
  });

  it('resolves nested condition_ref chains using the real repository', () => {
    storeCondition('core:has_token', {
      in: [{ var: 'actor.tokens' }, 'VIP_BADGE'],
    });
    storeCondition('core:is_allied', {
      and: [
        { '===': [{ var: 'actor.alignment' }, 'friendly'] },
        { condition_ref: 'core:has_token' },
      ],
    });
    storeCondition('core:can_enter', {
      or: [{ var: 'actor.is_invited' }, { condition_ref: 'core:is_allied' }],
    });

    const resolved = resolveReferences(
      { condition_ref: 'core:can_enter' },
      repository,
      logger
    );

    expect(resolved).toEqual({
      or: [
        { var: 'actor.is_invited' },
        {
          and: [
            { '===': [{ var: 'actor.alignment' }, 'friendly'] },
            {
              in: [{ var: 'actor.tokens' }, 'VIP_BADGE'],
            },
          ],
        },
      ],
    });

    expect(logger.debugMessages).toEqual([
      'GameDataRepository initialised (delegates to registry).',
      "Resolving condition_ref 'core:can_enter'...",
      "Resolving condition_ref 'core:is_allied'...",
      "Resolving condition_ref 'core:has_token'...",
    ]);
  });

  it('raises a helpful error when a referenced condition is missing', () => {
    storeCondition('core:requires_known_condition', {
      condition_ref: 'core:missing_condition',
    });

    expect(() =>
      resolveReferences(
        { condition_ref: 'core:requires_known_condition' },
        repository,
        logger
      )
    ).toThrow(
      "Could not resolve condition_ref 'core:missing_condition'. Definition or its logic property not found."
    );
  });

  it('detects circular references even across nested branches', () => {
    storeCondition('core:a', {
      or: [{ condition_ref: 'core:b' }, { var: 'actor.trust_level' }],
    });
    storeCondition('core:b', {
      and: [{ condition_ref: 'core:c' }, { var: 'actor.stealth' }],
    });
    storeCondition('core:c', {
      condition_ref: 'core:a',
    });

    expect(() =>
      resolveReferences({ condition_ref: 'core:a' }, repository, logger)
    ).toThrow(
      'Circular condition_ref detected. Path: core:a -> core:b -> core:c -> core:a'
    );
  });
});
