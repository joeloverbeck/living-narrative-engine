import { describe, it, expect } from '@jest/globals';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { SHUTDOWNABLE } from '../../../../src/dependencyInjection/tags.js';
import ShutdownService from '../../../../src/shutdown/services/shutdownService.js';

class TrackingContainer extends AppContainer {
  constructor() {
    super();
    this.disposeCallCount = 0;
  }

  disposeSingletons() {
    this.disposeCallCount += 1;
    super.disposeSingletons();
  }
}

class RecordingLogger {
  constructor() {
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

  hasErrorContaining(fragment) {
    return this.errorCalls.some(({ message }) => message.includes(fragment));
  }

  hasWarningContaining(fragment) {
    return this.warnCalls.some(({ message }) => message.includes(fragment));
  }
}

class ExplodingLogger extends RecordingLogger {
  constructor(triggerSubstring) {
    super();
    this.triggerSubstring = triggerSubstring;
    this.triggered = false;
  }

  debug(message, ...args) {
    super.debug(message, ...args);
    if (!this.triggered && message.includes(this.triggerSubstring)) {
      this.triggered = true;
      throw new Error('Synthetic logger failure');
    }
  }
}

class RecordingDispatcher {
  constructor({ failEvents = new Set() } = {}) {
    this.failEvents = new Set(failEvents);
    this.calls = [];
  }

  async dispatch(eventId, payload) {
    this.calls.push({ eventId, payload });
    if (this.failEvents.has(eventId)) {
      throw new Error(`dispatch failed for ${eventId}`);
    }
    return true;
  }

  getEventNames() {
    return this.calls.map((call) => call.eventId);
  }
}

class TestTurnManager {
  constructor() {
    this.stopCount = 0;
  }

  async stop() {
    this.stopCount += 1;
  }
}

class TestShutdownableSystem {
  constructor(name) {
    this.name = name;
    this.shutdownCount = 0;
  }

  shutdown() {
    this.shutdownCount += 1;
  }
}

/**
 *
 * @param container
 * @param root0
 * @param root0.logger
 * @param root0.turnManager
 * @param root0.systems
 */
function registerCommonDependencies(
  container,
  { logger, turnManager, systems }
) {
  container.register('ILogger', logger, { lifecycle: 'singleton' });
  container.register(tokens.ITurnManager, () => turnManager, {
    lifecycle: 'singleton',
  });
  systems.forEach((system, index) => {
    container.register(`shutdownable-system-${index}`, () => system, {
      lifecycle: 'singleton',
      tags: SHUTDOWNABLE,
    });
  });
}

describe('ShutdownService real module integration', () => {
  it('continues shutdown when UI notification dispatch fails', async () => {
    const container = new TrackingContainer();
    const logger = new RecordingLogger();
    const dispatcher = new RecordingDispatcher({
      failEvents: new Set(['ui:show_message']),
    });
    const turnManager = new TestTurnManager();
    const systems = [
      new TestShutdownableSystem('Alpha'),
      new TestShutdownableSystem('Beta'),
    ];

    registerCommonDependencies(container, { logger, turnManager, systems });

    const shutdownService = new ShutdownService({
      container,
      logger,
      validatedEventDispatcher: dispatcher,
    });

    await shutdownService.runShutdownSequence();

    expect(
      logger.hasErrorContaining('Failed to dispatch shutdown start UI event.')
    ).toBe(true);
    expect(turnManager.stopCount).toBe(1);
    systems.forEach((system) => {
      expect(system.shutdownCount).toBe(1);
    });
    expect(container.disposeCallCount).toBe(1);
    expect(dispatcher.getEventNames()).toEqual(
      expect.arrayContaining([
        'shutdown:shutdown_service:started',
        'shutdown:shutdown_service:completed',
        'ui:show_message',
      ])
    );
  });

  it('warns when container lacks disposeSingletons support', async () => {
    const container = new TrackingContainer();
    const logger = new RecordingLogger();
    const dispatcher = new RecordingDispatcher();
    const turnManager = new TestTurnManager();
    const systems = [new TestShutdownableSystem('Gamma')];

    registerCommonDependencies(container, { logger, turnManager, systems });

    // Simulate missing disposeSingletons capability
    container.disposeSingletons = undefined;

    const shutdownService = new ShutdownService({
      container,
      logger,
      validatedEventDispatcher: dispatcher,
    });

    await shutdownService.runShutdownSequence();

    expect(
      logger.hasWarningContaining(
        'Container does not have a disposeSingletons method'
      )
    ).toBe(true);
    expect(container.disposeCallCount).toBe(0);
    expect(dispatcher.getEventNames()).toContain(
      'shutdown:shutdown_service:completed'
    );
  });

  it('dispatches failure event when logger throws during shutdown sequence', async () => {
    const container = new TrackingContainer();
    const logger = new ExplodingLogger('Resolving and stopping TurnManager');
    const dispatcher = new RecordingDispatcher();
    const turnManager = new TestTurnManager();
    const systems = [new TestShutdownableSystem('Delta')];

    registerCommonDependencies(container, { logger, turnManager, systems });

    const shutdownService = new ShutdownService({
      container,
      logger,
      validatedEventDispatcher: dispatcher,
    });

    await shutdownService.runShutdownSequence();

    expect(
      logger.hasErrorContaining(
        'ShutdownService: CRITICAL ERROR during main shutdown sequence'
      )
    ).toBe(true);
    expect(dispatcher.getEventNames()).toContain(
      'shutdown:shutdown_service:failed'
    );
    expect(dispatcher.getEventNames()).not.toContain(
      'shutdown:shutdown_service:completed'
    );
  });
});
