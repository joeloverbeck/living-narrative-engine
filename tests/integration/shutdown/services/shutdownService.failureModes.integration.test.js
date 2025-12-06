/**
 * @file Integration tests exercising ShutdownService failure handling paths with real DI container interactions.
 */

import { describe, it, expect } from '@jest/globals';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { SHUTDOWNABLE } from '../../../../src/dependencyInjection/tags.js';
import ShutdownService from '../../../../src/shutdown/services/shutdownService.js';

class RecordingLogger {
  constructor(label = 'logger') {
    this.label = label;
    this.debugCalls = [];
    this.infoCalls = [];
    this.warnCalls = [];
    this.errorCalls = [];
  }

  debug(message, ...args) {
    this.debugCalls.push({ message, args });
  }

  info(message, ...args) {
    this.infoCalls.push({ message, args });
  }

  warn(message, ...args) {
    this.warnCalls.push({ message, args });
  }

  error(message, ...args) {
    this.errorCalls.push({ message, args });
  }

  findErrorContaining(fragment) {
    return this.errorCalls.find(({ message }) => message.includes(fragment));
  }

  findWarningContaining(fragment) {
    return this.warnCalls.find(({ message }) => message.includes(fragment));
  }

  findDebugContaining(fragment) {
    return this.debugCalls.find(({ message }) => message.includes(fragment));
  }
}

class RecordingDispatcher {
  constructor({ failures = {} } = {}) {
    this.failures = new Map(
      Object.entries(failures).map(([eventId, error]) => [
        eventId,
        error instanceof Error ? error : new Error(String(error)),
      ])
    );
    this.calls = [];
  }

  async dispatch(eventId, payload) {
    this.calls.push({ eventId, payload });
    if (this.failures.has(eventId)) {
      throw this.failures.get(eventId);
    }
    return true;
  }

  setFailure(eventId, error) {
    this.failures.set(
      eventId,
      error instanceof Error ? error : new Error(String(error))
    );
  }

  getCall(eventId) {
    return this.calls.find((call) => call.eventId === eventId);
  }
}

class ObjectThrowingLogger extends RecordingLogger {
  constructor(triggerSubstring) {
    super('object-throwing');
    this.triggerSubstring = triggerSubstring;
    this.triggered = false;
  }

  debug(message, ...args) {
    super.debug(message, ...args);
    if (!this.triggered && message.includes(this.triggerSubstring)) {
      this.triggered = true;
      throw { stack: 'synthetic stack' };
    }
  }
}

class TestTurnManager {
  constructor({ shouldThrow = false } = {}) {
    this.shouldThrow = shouldThrow;
    this.stopCount = 0;
  }

  async stop() {
    this.stopCount += 1;
    if (this.shouldThrow) {
      throw new Error('turn manager stop failure');
    }
  }
}

class ShutdownableSystem {
  constructor(name, { shouldThrow = false } = {}) {
    this.name = name;
    this.shouldThrow = shouldThrow;
    this.shutdownCount = 0;
  }

  shutdown() {
    this.shutdownCount += 1;
    if (this.shouldThrow) {
      throw new Error(`${this.name} shutdown failure`);
    }
  }
}

class NonShutdownSystem {
  constructor(name) {
    this.name = name;
  }
}

/**
 *
 * @param container
 * @param systems
 */
function registerShutdownSystems(container, systems) {
  systems.forEach((system, index) => {
    container.register(`shutdownable-system-${index}`, () => system, {
      lifecycle: 'singleton',
      tags: SHUTDOWNABLE,
    });
  });
}

describe('ShutdownService constructor validation integration', () => {
  it('throws when container dependency is missing', () => {
    const logger = new RecordingLogger();
    const dispatcher = new RecordingDispatcher();

    expect(
      () =>
        new ShutdownService({
          logger,
          validatedEventDispatcher: dispatcher,
        })
    ).toThrow("ShutdownService: Missing required dependency 'container'.");
  });

  it('throws when logger lacks required methods and attempts container fallback', () => {
    const container = new AppContainer();
    const fallbackLogger = new RecordingLogger('fallback');
    container.register('ILogger', fallbackLogger, { lifecycle: 'singleton' });
    const dispatcher = new RecordingDispatcher();

    expect(
      () =>
        new ShutdownService({
          container,
          logger: { debug: () => {} },
          validatedEventDispatcher: dispatcher,
        })
    ).toThrow(
      "ShutdownService: Missing or invalid required dependency 'logger'."
    );

    expect(
      fallbackLogger.findErrorContaining(
        "ShutdownService: Missing or invalid required dependency 'logger'."
      )
    ).toBeTruthy();
  });

  it('falls back gracefully when container logger lacks error method', () => {
    const container = new AppContainer();
    container.register(
      'ILogger',
      { warn: () => {} },
      { lifecycle: 'singleton' }
    );
    const dispatcher = new RecordingDispatcher();

    expect(
      () =>
        new ShutdownService({
          container,
          logger: { debug: () => {} },
          validatedEventDispatcher: dispatcher,
        })
    ).toThrow(
      "ShutdownService: Missing or invalid required dependency 'logger'."
    );
  });

  it('throws when validatedEventDispatcher lacks dispatch function', () => {
    const container = new AppContainer();
    const logger = new RecordingLogger();
    container.register('ILogger', logger, { lifecycle: 'singleton' });

    expect(
      () =>
        new ShutdownService({
          container,
          logger,
          validatedEventDispatcher: {},
        })
    ).toThrow(
      "ShutdownService: Missing or invalid required dependency 'validatedEventDispatcher'."
    );

    expect(
      logger.findErrorContaining(
        "ShutdownService: Missing or invalid required dependency 'validatedEventDispatcher'."
      )
    ).toBeTruthy();
  });
});

/**
 *
 * @param root0
 * @param root0.logger
 * @param root0.dispatcher
 * @param root0.turnManager
 * @param root0.systems
 * @param root0.configureContainer
 */
function createServiceHarness({
  logger = new RecordingLogger(),
  dispatcher = new RecordingDispatcher(),
  turnManager = new TestTurnManager(),
  systems = [],
  configureContainer,
} = {}) {
  const container = new AppContainer();
  container.register('ILogger', logger, { lifecycle: 'singleton' });
  container.register(tokens.ITurnManager, () => turnManager, {
    lifecycle: 'singleton',
  });

  registerShutdownSystems(container, systems);

  if (configureContainer) {
    configureContainer(container);
  }

  const shutdownService = new ShutdownService({
    container,
    logger,
    validatedEventDispatcher: dispatcher,
  });

  return {
    shutdownService,
    container,
    logger,
    dispatcher,
    turnManager,
    systems,
  };
}

describe('ShutdownService failure mode integration', () => {
  it('logs turn manager failures and continues when resolving shutdownable systems throws', async () => {
    const logger = new RecordingLogger();
    const dispatcher = new RecordingDispatcher();
    const turnManager = new TestTurnManager({ shouldThrow: true });

    const { shutdownService, container } = createServiceHarness({
      logger,
      dispatcher,
      turnManager,
      configureContainer: (c) => {
        c.resolveByTag = () => {
          throw new Error('resolveByTag failure');
        };
      },
    });

    await shutdownService.runShutdownSequence();

    expect(
      logger.findErrorContaining(
        'ShutdownService: Error resolving or stopping TurnManager. Continuing shutdown...'
      )
    ).toBeTruthy();
    expect(
      logger.findErrorContaining(
        'ShutdownService: CRITICAL ERROR resolving SHUTDOWNABLE systems. Cannot proceed with tagged system shutdown.'
      )
    ).toBeTruthy();
    expect(
      dispatcher.getCall('shutdown:shutdown_service:completed')
    ).toBeDefined();
    // ensure container override was invoked (no systems registered)
    expect(() => container.resolveByTag(SHUTDOWNABLE[0])).toThrow(
      'resolveByTag failure'
    );
  });

  it('handles mixed shutdownable systems and records individual failures', async () => {
    const logger = new RecordingLogger();
    const dispatcher = new RecordingDispatcher();
    const systems = [
      new ShutdownableSystem('Graceful'),
      new ShutdownableSystem('Exploding', { shouldThrow: true }),
      new NonShutdownSystem('Noop'),
      null,
    ];

    const { shutdownService } = createServiceHarness({
      logger,
      dispatcher,
      systems,
    });

    await shutdownService.runShutdownSequence();

    expect(systems[0].shutdownCount).toBe(1);
    expect(systems[1].shutdownCount).toBe(1);
    expect(
      logger.findErrorContaining(
        'ShutdownService: Error during shutdown() call for system: ShutdownableSystem'
      )
    ).toBeTruthy();
    expect(
      logger.findWarningContaining(
        'ShutdownService: System tagged SHUTDOWNABLE (NonShutdownSystem) does not have a valid shutdown() method.'
      )
    ).toBeTruthy();
    expect(
      logger.findWarningContaining(
        'ShutdownService: System tagged SHUTDOWNABLE (UnknownSystem) does not have a valid shutdown() method.'
      )
    ).toBeTruthy();
    expect(
      dispatcher.getCall('shutdown:shutdown_service:completed')
    ).toBeDefined();
  });

  it('recovers when singleton disposal and completion dispatch fail', async () => {
    const logger = new RecordingLogger();
    const dispatcher = new RecordingDispatcher({
      failures: {
        'shutdown:shutdown_service:completed': new Error(
          'completed dispatch failure'
        ),
      },
    });

    const { shutdownService, container } = createServiceHarness({
      logger,
      dispatcher,
      configureContainer: (c) => {
        const originalDispose = c.disposeSingletons.bind(c);
        c.disposeSingletons = () => {
          originalDispose();
          throw new Error('dispose failure');
        };
      },
    });

    await shutdownService.runShutdownSequence();

    expect(
      logger.findErrorContaining(
        'ShutdownService: Error occurred during container.disposeSingletons().'
      )
    ).toBeTruthy();
    expect(
      logger.findErrorContaining(
        "Failed to dispatch 'shutdown:shutdown_service:completed' event"
      )
    ).toBeTruthy();
    expect(
      dispatcher.getCall('shutdown:shutdown_service:completed')
    ).toBeDefined();
    expect(container.resolve(tokens.ITurnManager)).toBeDefined();
  });

  it('dispatches failure payload with unknown error details when logger throws object without message', async () => {
    const logger = new ObjectThrowingLogger(
      'Resolving and stopping TurnManager'
    );
    const dispatcher = new RecordingDispatcher();
    const systems = [new ShutdownableSystem('Gamma')];

    const { shutdownService } = createServiceHarness({
      logger,
      dispatcher,
      systems,
    });

    await shutdownService.runShutdownSequence();

    const failureCall = dispatcher.getCall('shutdown:shutdown_service:failed');
    expect(failureCall).toBeDefined();
    expect(failureCall.payload.error).toBe('Unknown error');
    expect(failureCall.payload.stack).toBe('synthetic stack');
  });
});
