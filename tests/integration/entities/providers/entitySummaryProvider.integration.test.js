import { describe, it, expect, beforeEach } from '@jest/globals';
import { EntitySummaryProvider } from '../../../../src/data/providers/entitySummaryProvider.js';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../../src/entities/entityInstanceData.js';
import Entity from '../../../../src/entities/entity.js';
import ConsoleLogger, {
  LogLevel,
} from '../../../../src/logging/consoleLogger.js';
import {
  NAME_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  APPARENT_AGE_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { DEFAULT_FALLBACK_DESCRIPTION_RAW } from '../../../../src/constants/textDefaults.js';

const buildEntity = ({
  definitionId = 'integration:test_definition',
  instanceId = 'integration:test_instance',
  definitionComponents = {},
  overrides = {},
} = {}) => {
  const logger = new ConsoleLogger(LogLevel.NONE);
  const definition = new EntityDefinition(definitionId, {
    description: 'integration entity',
    components: definitionComponents,
  });
  const instanceData = new EntityInstanceData(
    instanceId,
    definition,
    overrides,
    logger
  );
  return new Entity(instanceData);
};

describe('EntitySummaryProvider integration', () => {
  let provider;

  beforeEach(() => {
    provider = new EntitySummaryProvider();
  });

  it('returns trimmed summary values and includes apparent age data from real entities', () => {
    const apparentAgeData = {
      minAge: 26,
      maxAge: 32,
      bestGuess: 29,
    };

    const entity = buildEntity({
      definitionComponents: {
        [DESCRIPTION_COMPONENT_ID]: { text: '  Stoic guardian of the realm ' },
        [APPARENT_AGE_COMPONENT_ID]: apparentAgeData,
      },
      overrides: {
        [NAME_COMPONENT_ID]: { text: '  Aria Stormwalker  ' },
      },
    });

    const summary = provider.getSummary(entity);

    expect(summary).toEqual({
      id: 'integration:test_instance',
      name: 'Aria Stormwalker',
      description: 'Stoic guardian of the realm',
      apparentAge: apparentAgeData,
    });
  });

  it('falls back to defaults when entity components are absent or blank', () => {
    const entity = buildEntity({
      definitionComponents: {
        [DESCRIPTION_COMPONENT_ID]: { text: '   ' },
      },
    });

    const summary = provider.getSummary(entity);

    expect(summary).toEqual({
      id: 'integration:test_instance',
      name: null,
      description: DEFAULT_FALLBACK_DESCRIPTION_RAW,
    });
    expect(summary).not.toHaveProperty('apparentAge');
  });

  it('gracefully handles entities without component access by returning the provided default', () => {
    const defaultValue = 'unknown';

    expect(
      provider._getComponentText(null, NAME_COMPONENT_ID, defaultValue)
    ).toBe(defaultValue);

    expect(
      provider._getComponentText(
        { id: 'no-method-entity' },
        DESCRIPTION_COMPONENT_ID,
        defaultValue
      )
    ).toBe(defaultValue);
  });
});
