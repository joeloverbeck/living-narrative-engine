import { applySchemaDefaults } from '../../../../../src/logic/operationHandlers/helpers/applySchemaDefaults.js';

describe('applySchemaDefaults', () => {
  const logger = { debug: jest.fn() };

  beforeEach(() => {
    logger.debug.mockClear();
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
});
