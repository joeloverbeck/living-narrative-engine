import { applySchemaDefaults } from '../../../../../src/logic/operationHandlers/helpers/applySchemaDefaults.js';

describe('applySchemaDefaults', () => {
  const logger = { debug: jest.fn() };

  beforeEach(() => {
    logger.debug.mockClear();
  });

  it('returns the original value when the component definition is missing schema', () => {
    const originalValue = { mood: 'alert' };

    const result = applySchemaDefaults(originalValue, {}, logger);

    expect(result).toBe(originalValue);
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('applies defaults when no initial value is provided', () => {
    const componentDefinition = {
      dataSchema: {
        properties: {
          mood: { type: 'string', default: 'calm' },
          details: {
            type: 'object',
            properties: {
              intensity: { type: 'number', default: 3 },
            },
          },
        },
      },
    };

    const result = applySchemaDefaults(undefined, componentDefinition, logger);

    expect(result).toEqual({
      mood: 'calm',
      details: { intensity: 3 },
    });
  });

  it('does not create nested objects when nested schemas lack defaults', () => {
    const componentDefinition = {
      dataSchema: {
        properties: {
          metadata: {
            type: 'object',
            properties: {
              info: { type: 'string' },
            },
          },
        },
      },
    };

    const result = applySchemaDefaults({}, componentDefinition, logger);

    expect(result).toEqual({});
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('skips creating deeper nested objects when inner schemas lack defaults', () => {
    const componentDefinition = {
      dataSchema: {
        properties: {
          config: {
            type: 'object',
            properties: {
              nested: {
                type: 'object',
                properties: {
                  deeper: { type: 'string' },
                },
              },
            },
          },
        },
      },
    };

    const result = applySchemaDefaults(
      { config: {} },
      componentDefinition,
      logger
    );

    expect(result).toEqual({ config: {} });
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('preserves provided values while applying nested defaults', () => {
    const componentDefinition = {
      dataSchema: {
        properties: {
          mood: { type: 'string', default: 'calm' },
          details: {
            type: 'object',
            properties: {
              intensity: { type: 'number', default: 3 },
              description: { type: 'string', default: 'neutral' },
            },
          },
        },
      },
    };

    const result = applySchemaDefaults(
      {
        mood: 'excited',
        details: { intensity: 7 },
      },
      componentDefinition,
      logger
    );

    expect(result).toEqual({
      mood: 'excited',
      details: { intensity: 7, description: 'neutral' },
    });
  });

  it('creates intermediate objects and applies deeply nested defaults', () => {
    const componentDefinition = {
      dataSchema: {
        properties: {
          settings: {
            type: 'object',
            properties: {
              theme: { type: 'string', default: 'light' },
              nested: {
                type: 'object',
                properties: {
                  note: { type: 'string', default: 'remember' },
                  deep: {
                    type: 'object',
                    properties: {
                      tone: { type: 'string', default: 'soft' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = applySchemaDefaults(
      {
        settings: 'not-an-object',
      },
      componentDefinition,
      logger
    );

    expect(result).toEqual({
      settings: {
        theme: 'light',
        nested: {
          note: 'remember',
          deep: {
            tone: 'soft',
          },
        },
      },
    });

    expect(logger.debug).not.toHaveBeenCalledWith(
      "applySchemaDefaults: Created object for 'settings' to apply nested defaults"
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "applySchemaDefaults: Applied nested default for 'theme'",
      { default: 'light' }
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "applySchemaDefaults: Created nested object for 'nested' to apply defaults"
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "applySchemaDefaults: Created nested object for 'deep' to apply defaults"
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "applySchemaDefaults: Applied nested default for 'note'",
      { default: 'remember' }
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "applySchemaDefaults: Applied nested default for 'tone'",
      { default: 'soft' }
    );
  });

  it('preserves existing deeply nested objects while filling missing defaults', () => {
    const componentDefinition = {
      dataSchema: {
        properties: {
          settings: {
            type: 'object',
            properties: {
              theme: { type: 'string', default: 'light' },
              nested: {
                type: 'object',
                properties: {
                  note: { type: 'string', default: 'remember' },
                  deep: {
                    type: 'object',
                    properties: {
                      tone: { type: 'string', default: 'soft' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = applySchemaDefaults(
      {
        settings: {
          nested: {
            note: 'keep this',
            deep: { tone: 'custom' },
          },
        },
      },
      componentDefinition,
      logger
    );

    expect(result).toEqual({
      settings: {
        theme: 'light',
        nested: {
          note: 'keep this',
          deep: { tone: 'custom' },
        },
      },
    });

    expect(logger.debug).toHaveBeenCalledWith(
      "applySchemaDefaults: Applied nested default for 'theme'",
      { default: 'light' }
    );
    expect(logger.debug).not.toHaveBeenCalledWith(
      "applySchemaDefaults: Created nested object for 'nested' to apply defaults"
    );
    expect(logger.debug).not.toHaveBeenCalledWith(
      "applySchemaDefaults: Created nested object for 'deep' to apply defaults"
    );
  });
});
