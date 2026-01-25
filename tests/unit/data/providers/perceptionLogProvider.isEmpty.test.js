import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { PerceptionLogProvider } from '../../../../src/data/providers/perceptionLogProvider.js';
import { PERCEPTION_LOG_COMPONENT_ID } from '../../../../src/constants/componentIds.js';

class MockEntity {
  constructor(id, components = {}) {
    this.id = id;
    this._components = { ...components };
  }

  hasComponent(id) {
    return Object.prototype.hasOwnProperty.call(this._components, id);
  }

  getComponentData(id) {
    return this._components[id];
  }
}

const createMockLogger = () => ({ debug: jest.fn() });

const createMockDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(true),
});

describe('PerceptionLogProvider.isEmpty', () => {
  let provider;
  let logger;
  let dispatcher;

  beforeEach(() => {
    provider = new PerceptionLogProvider();
    logger = createMockLogger();
    dispatcher = createMockDispatcher();
  });

  it('returns true when actor has no perception log component', async () => {
    const actor = new MockEntity('actor-1', {});

    const result = await provider.isEmpty(actor, logger, dispatcher);

    expect(result).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('has no perception log component')
    );
  });

  it('returns true when logEntries is empty array', async () => {
    const actor = new MockEntity('actor-2', {
      [PERCEPTION_LOG_COMPONENT_ID]: { logEntries: [] },
    });

    const result = await provider.isEmpty(actor, logger, dispatcher);

    expect(result).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('perception log is empty')
    );
  });

  it('returns true when logEntries is null', async () => {
    const actor = new MockEntity('actor-3', {
      [PERCEPTION_LOG_COMPONENT_ID]: { logEntries: null },
    });

    const result = await provider.isEmpty(actor, logger, dispatcher);

    expect(result).toBe(true);
  });

  it('returns true when logEntries is undefined', async () => {
    const actor = new MockEntity('actor-4', {
      [PERCEPTION_LOG_COMPONENT_ID]: {},
    });

    const result = await provider.isEmpty(actor, logger, dispatcher);

    expect(result).toBe(true);
  });

  it('returns true when perception data itself is null', async () => {
    const actor = new MockEntity('actor-5');
    actor._components[PERCEPTION_LOG_COMPONENT_ID] = null;

    const result = await provider.isEmpty(actor, logger, dispatcher);

    expect(result).toBe(true);
  });

  it('returns false when logEntries has entries', async () => {
    const actor = new MockEntity('actor-6', {
      [PERCEPTION_LOG_COMPONENT_ID]: {
        logEntries: [
          {
            descriptionText: 'Something happened',
            timestamp: Date.now(),
            perceptionType: 'action',
          },
        ],
      },
    });

    const result = await provider.isEmpty(actor, logger, dispatcher);

    expect(result).toBe(false);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('has 1 entries')
    );
  });

  it('returns false when logEntries has multiple entries', async () => {
    const actor = new MockEntity('actor-7', {
      [PERCEPTION_LOG_COMPONENT_ID]: {
        logEntries: [
          { descriptionText: 'Event 1', timestamp: Date.now(), perceptionType: 'action' },
          { descriptionText: 'Event 2', timestamp: Date.now(), perceptionType: 'speech' },
          { descriptionText: 'Event 3', timestamp: Date.now(), perceptionType: 'observation' },
        ],
      },
    });

    const result = await provider.isEmpty(actor, logger, dispatcher);

    expect(result).toBe(false);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('has 3 entries')
    );
  });

  it('returns true on error (fail safe)', async () => {
    const actor = new MockEntity('actor-8', {
      [PERCEPTION_LOG_COMPONENT_ID]: { logEntries: [] },
    });
    // Force an error by making getComponentData throw
    actor.getComponentData = () => {
      throw new Error('Component access error');
    };

    const result = await provider.isEmpty(actor, logger, dispatcher);

    expect(result).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Error occurred, treating as empty for safety')
    );
  });

  it('dispatches error event on error', async () => {
    const actor = new MockEntity('actor-9', {
      [PERCEPTION_LOG_COMPONENT_ID]: { logEntries: [] },
    });
    actor.getComponentData = () => {
      throw new Error('Component access error');
    };

    await provider.isEmpty(actor, logger, dispatcher);

    expect(dispatcher.dispatch).toHaveBeenCalled();
  });

  it('logs debug messages for checking perception log', async () => {
    const actor = new MockEntity('actor-10', {
      [PERCEPTION_LOG_COMPONENT_ID]: { logEntries: [] },
    });

    await provider.isEmpty(actor, logger, dispatcher);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Checking perception log for actor')
    );
  });
});
