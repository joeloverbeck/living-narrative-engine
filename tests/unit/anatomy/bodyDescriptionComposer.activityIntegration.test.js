import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('BodyDescriptionComposer - Activity Integration', () => {
  let mockBodyPartDescriptionBuilder;
  let mockBodyGraphService;
  let mockEntityFinder;
  let mockAnatomyFormattingService;
  let mockPartDescriptionGenerator;
  let mockLogger;
  let mockBodyEntity;

  beforeEach(() => {
    // Create mocks
    mockBodyPartDescriptionBuilder = {
      buildDescription: jest.fn(),
      buildMultipleDescription: jest.fn(),
      getPlural: jest.fn(),
    };

    mockBodyGraphService = {
      getAllParts: jest.fn().mockReturnValue(['part-1', 'part-2']),
    };

    mockEntityFinder = {
      getEntityInstance: jest.fn(),
    };

    // Mock anatomyFormattingService
    // Note: Each test will configure getDescriptionOrder as needed
    mockAnatomyFormattingService = {
      getDescriptionOrder: jest.fn(),
      getGroupedParts: jest.fn(),
    };

    mockPartDescriptionGenerator = {
      generatePartDescription: jest.fn(),
      generateDescription: jest.fn(),
      generateSimpleDescription: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock body entity matching pattern from bodyDescriptionComposer.test.js
    mockBodyEntity = {
      id: 'test_body',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          return {
            body: {
              root: 'torso-1',
              descriptors: {
                build: 'athletic',
              },
            },
          };
        }
        if (componentId === 'descriptors:build') {
          return { build: 'athletic' };
        }
        return null;
      }),
    };
  });

  it('should call activity service when injected', async () => {
    // Configure description order to include 'activity' BEFORE creating composer
    mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
      'build',
      'body_hair',
      'body_composition',
      'equipment',
      'activity',
    ]);

    // Using project-standard inline Jest mock pattern
    const mockActivityService = {
      generateActivityDescription: jest.fn(),
    };
    mockActivityService.generateActivityDescription.mockResolvedValue(
      'Activity: Jon is kneeling before Alicia'
    );

    const composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      anatomyFormattingService: mockAnatomyFormattingService,
      partDescriptionGenerator: mockPartDescriptionGenerator,
      activityDescriptionService: mockActivityService,
      logger: mockLogger,
    });

    const result = await composer.composeDescription(mockBodyEntity);

    expect(mockActivityService.generateActivityDescription).toHaveBeenCalledWith(
      mockBodyEntity.id
    );
    expect(result).toContain('Activity: Jon is kneeling before Alicia');
  });

  it('should work without activity service (backward compatibility)', async () => {
    const composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      anatomyFormattingService: mockAnatomyFormattingService,
      partDescriptionGenerator: mockPartDescriptionGenerator,
      activityDescriptionService: null, // Not injected
      logger: mockLogger,
    });

    const result = await composer.composeDescription(mockBodyEntity);

    // Should not crash, just no activity line
    expect(result).not.toContain('Activity:');
  });

  it('should not add line if service returns empty string', async () => {
    // Configure description order to include 'activity' BEFORE creating composer
    mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
      'build',
      'body_hair',
      'body_composition',
      'equipment',
      'activity',
    ]);

    const mockActivityService = {
      generateActivityDescription: jest.fn(),
    };
    mockActivityService.generateActivityDescription.mockResolvedValue('');

    const composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      anatomyFormattingService: mockAnatomyFormattingService,
      partDescriptionGenerator: mockPartDescriptionGenerator,
      activityDescriptionService: mockActivityService,
      logger: mockLogger,
    });

    const result = await composer.composeDescription(mockBodyEntity);

    expect(result).not.toContain('Activity:');
  });

  it('should process activity in correct order', async () => {
    // NOTE: This test requires 'activity' in description order (see ACTDESC-011)
    // The configuration must include 'activity' for this to execute
    const mockEquipmentService = {
      generateEquipmentDescription: jest
        .fn()
        .mockResolvedValue('Equipment: Jon is wearing a leather jacket'),
    };

    const mockActivityService = {
      generateActivityDescription: jest
        .fn()
        .mockResolvedValue('Activity: Jon is kneeling before Alicia'),
    };

    // Configure description order with activity after equipment
    mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
      'height',
      'equipment',
      'activity',
    ]);

    const composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      anatomyFormattingService: mockAnatomyFormattingService,
      partDescriptionGenerator: mockPartDescriptionGenerator,
      equipmentDescriptionService: mockEquipmentService,
      activityDescriptionService: mockActivityService,
      logger: mockLogger,
    });

    const result = await composer.composeDescription(mockBodyEntity);
    const lines = result.split('\n');

    // Activity line should appear after equipment line
    const equipmentIndex = lines.findIndex((l) => l.includes('Equipment:'));
    const activityIndex = lines.findIndex((l) => l.includes('Activity:'));

    // Both lines should be present
    expect(equipmentIndex).toBeGreaterThanOrEqual(0);
    expect(activityIndex).toBeGreaterThanOrEqual(0);
    // Activity line should appear after equipment line
    expect(activityIndex).toBeGreaterThan(equipmentIndex);
  });

  it('should mark activity as processed type', async () => {
    // Configure description order to include 'activity' BEFORE creating composer
    mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
      'build',
      'body_hair',
      'body_composition',
      'equipment',
      'activity',
    ]);

    const mockActivityService = {
      generateActivityDescription: jest
        .fn()
        .mockResolvedValue('Activity: Jon is kneeling'),
    };

    const composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      anatomyFormattingService: mockAnatomyFormattingService,
      partDescriptionGenerator: mockPartDescriptionGenerator,
      activityDescriptionService: mockActivityService,
      logger: mockLogger,
    });

    const result = await composer.composeDescription(mockBodyEntity);

    // Verify service was called exactly once (not multiple times)
    expect(mockActivityService.generateActivityDescription).toHaveBeenCalledTimes(
      1
    );
    expect(result).toContain('Activity: Jon is kneeling');
  });
});
