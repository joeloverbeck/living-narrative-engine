/**
 * @file Mock ModsLoader for testing - provides immediate success without file I/O
 * @description Simulates mod loading with pre-registered event definitions
 */

/**
 * Mock ModsLoader that pre-registers required event definitions
 * Eliminates timeout issues caused by real mod loading pipeline
 */
class MockModsLoader {
  #logger;
  #dataRegistry;

  constructor({ logger, cache, session, registry }) {
    this.#logger = logger;
    this.#dataRegistry = registry;
  }

  /**
   * Mock mod loading that immediately succeeds with pre-registered events
   *
   * @param {string} worldName - World name (ignored in mock)
   * @param {string[]} modIds - Mod IDs (ignored in mock)
   * @returns {Promise<object>} Success report
   */
  async loadMods(worldName, modIds = []) {
    this.#logger?.debug(
      `MockModsLoader: Simulating load for world '${worldName}' with mods: ${modIds.join(', ')}`
    );

    // Pre-register the event definitions that the test expects
    this.#registerRequiredEvents();

    this.#logger?.info(
      `MockModsLoader: Mock load completed successfully for world '${worldName}'`
    );

    return {
      finalModOrder: [...modIds],
      totals: {
        events: 2,
        schemas: 2,
        components: 0,
        actions: 0,
        rules: 0,
        entities: 0,
      },
      incompatibilities: [],
    };
  }

  /**
   * Register event definitions that tests expect to find
   *
   * @private
   */
  #registerRequiredEvents() {
    const eventDefinitions = [
      {
        id: 'UI_STATE_CHANGED',
        description: 'Signals when a UI controller changes its display state',
        payloadSchema: {
          type: 'object',
          properties: {
            controller: {
              description: 'The name of the controller that changed state',
              type: 'string',
              minLength: 1,
            },
            previousState: {
              description: 'The previous state (null for initial state change)',
              oneOf: [
                {
                  type: 'string',
                  enum: ['empty', 'loading', 'results', 'error'],
                },
                {
                  type: 'null',
                },
              ],
            },
            currentState: {
              description: 'The new current state',
              type: 'string',
              enum: ['empty', 'loading', 'results', 'error'],
            },
            timestamp: {
              description:
                'ISO 8601 timestamp of when the state change occurred',
              type: 'string',
              pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$',
            },
          },
          required: ['controller', 'currentState', 'timestamp'],
          additionalProperties: false,
        },
      },
      {
        id: 'CONTROLLER_INITIALIZED',
        description:
          'Signals when a character builder controller has completed its initialization',
        payloadSchema: {
          type: 'object',
          properties: {
            controllerName: {
              description:
                'The name of the controller that completed initialization',
              type: 'string',
              minLength: 1,
            },
            initializationTime: {
              description:
                'Time taken to initialize the controller in milliseconds',
              type: 'number',
              minimum: 0,
            },
          },
          required: ['controllerName', 'initializationTime'],
          additionalProperties: false,
        },
      },
    ];

    // Register events with data registry if available
    if (
      this.#dataRegistry &&
      typeof this.#dataRegistry.setEventDefinition === 'function'
    ) {
      eventDefinitions.forEach((eventDef) => {
        this.#dataRegistry.setEventDefinition(eventDef.id, eventDef);
        this.#logger?.debug(
          `MockModsLoader: Registered event definition: ${eventDef.id}`
        );
      });
    } else {
      this.#logger?.warn(
        'MockModsLoader: DataRegistry not available for event registration'
      );
    }
  }
}

// Support both CommonJS and ES modules
module.exports = { MockModsLoader };
export { MockModsLoader };
export default MockModsLoader;
