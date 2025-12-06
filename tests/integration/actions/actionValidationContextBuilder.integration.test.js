/**
 * @file Integration tests for ActionValidationContextBuilder.
 * @description Exercises the builder with real entity manager and validation helpers
 *              to ensure prerequisite contexts are assembled through the production
 *              code paths rather than mocks.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionValidationContextBuilder } from '../../../src/actions/validation/actionValidationContextBuilder.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

class TestLogger {
  constructor() {
    this.messages = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  debug(...args) {
    this.messages.debug.push(args);
  }

  info(...args) {
    this.messages.info.push(args);
  }

  warn(...args) {
    this.messages.warn.push(args);
  }

  error(...args) {
    this.messages.error.push(args);
  }
}

describe('ActionValidationContextBuilder integration', () => {
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {TestLogger} */
  let logger;
  /** @type {ActionValidationContextBuilder} */
  let builder;

  beforeEach(() => {
    logger = new TestLogger();
    entityManager = new SimpleEntityManager([
      {
        id: 'actor-101',
        components: {
          'core:profile': { name: 'Astra' },
          'core:status': { stance: 'stealth' },
          'core:position': { locationId: 'observation-deck' },
        },
      },
    ]);

    builder = new ActionValidationContextBuilder({
      entityManager,
      logger,
    });
  });

  it('builds an actor-only validation context with live component accessors', () => {
    const actor = entityManager.getEntityInstance('actor-101');
    const actionDefinition = { id: 'stealth:scout' };

    const context = builder.buildContext(actionDefinition, actor);

    expect(context).toEqual({
      actor: expect.objectContaining({ id: 'actor-101' }),
    });

    const components = context.actor.components;
    expect(components['core:profile']).toEqual({ name: 'Astra' });
    expect(components['core:status']).toEqual({ stance: 'stealth' });
    expect('core:position' in components).toBe(true);
    expect(components['non-existent']).toBeNull();

    const serialized = components.toJSON();
    expect(serialized).toEqual({
      'core:profile': { name: 'Astra' },
      'core:status': { stance: 'stealth' },
      'core:position': { locationId: 'observation-deck' },
    });

    const loggedMessages = logger.messages.debug.map((args) => args.join(' '));
    expect(
      loggedMessages.some((message) =>
        message.includes(
          'Validated inputs - Action: stealth:scout, Actor: actor-101'
        )
      )
    ).toBe(true);
    expect(
      loggedMessages.some((message) =>
        message.includes(
          'ActionValidationContextBuilder: Building context for action'
        )
      )
    ).toBe(true);
  });

  it('wraps invalid inputs with formatted validation errors', () => {
    const actionDefinition = { id: 'navigation:move' };
    const invalidActor = { id: null };

    let caughtError;
    try {
      builder.buildContext(actionDefinition, invalidActor);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError.name).toBe('ValidationError');
    expect(caughtError.message).toBe(
      'ActionValidationContextBuilder.buildContext: Actor must have a valid id property'
    );
    expect(caughtError.metadata).toEqual({
      actionId: 'navigation:move',
      actorId: null,
    });
    expect(caughtError.originalError).toBeInstanceOf(Error);
    expect(caughtError.originalError.message).toBe(
      'Actor must have a valid id property'
    );

    const loggedMessages = logger.messages.debug.flat();
    expect(
      loggedMessages.some(
        (fragment) =>
          typeof fragment === 'string' &&
          fragment.includes(
            'Validated inputs - Action: navigation:move, Actor: null'
          )
      )
    ).toBe(false);
  });
});
