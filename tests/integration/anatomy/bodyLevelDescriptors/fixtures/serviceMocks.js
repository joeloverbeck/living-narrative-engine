import { jest } from '@jest/globals';

/**
 * Create mocks for BodyDescriptionComposer dependencies
 */
export const createServiceMocks = () => {
  const mockBodyPartDescriptionBuilder = {
    buildDescription: jest.fn(),
    buildMultipleDescription: jest.fn(),
    getPlural: jest.fn(),
  };

  const mockBodyGraphService = {
    getAllParts: jest
      .fn()
      .mockReturnValue(['head-part-id', 'hair-part-id', 'eyes-part-id']),
  };

  const mockEntityFinder = {
    getEntityInstance: jest.fn().mockImplementation((partId) => {
      // Return mock part entities with core:description components
      return {
        id: partId,
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'core:description') {
            return { text: `Generated description for ${partId}` };
          }
          if (componentId === 'anatomy:part') {
            const subTypeMap = {
              'head-part-id': 'head',
              'hair-part-id': 'hair',
              'eyes-part-id': 'eyes',
            };
            return { subType: subTypeMap[partId] || 'unknown' };
          }
          return null;
        }),
      };
    }),
  };

  const mockAnatomyFormattingService = {
    getDescriptionOrder: jest
      .fn()
      .mockReturnValue([
        'height',
        'skin_color',
        'build',
        'body_composition',
        'body_hair',
        'smell',
        'head',
        'hair',
        'eyes',
      ]),
    getGroupedParts: jest.fn(),
  };

  const mockPartDescriptionGenerator = {
    generatePartDescription: jest.fn().mockImplementation((partId) => {
      return `Generated description for ${partId}`;
    }),
  };

  const mockEquipmentDescriptionService = {
    generateEquipmentDescription: jest
      .fn()
      .mockResolvedValue('Equipment description'),
  };

  return {
    mockBodyPartDescriptionBuilder,
    mockBodyGraphService,
    mockEntityFinder,
    mockAnatomyFormattingService,
    mockPartDescriptionGenerator,
    mockEquipmentDescriptionService,
  };
};

/**
 * Create realistic mocks with detailed behavior
 */
export const createRealisticServiceMocks = () => {
  const mockBodyPartDescriptionBuilder = {
    buildDescription: jest.fn().mockImplementation((entity) => {
      const partType = entity.getComponentData('anatomy:part')?.subType;
      return `${partType} description`;
    }),
    buildMultipleDescription: jest.fn().mockImplementation((entities) => {
      return entities.map((e) => e.id).join(', ');
    }),
    getPlural: jest.fn().mockImplementation((word) => `${word}s`),
  };

  const mockBodyGraphService = {
    getAllParts: jest
      .fn()
      .mockReturnValue(['head-part-id', 'hair-part-id', 'eyes-part-id']),
  };

  const mockEntityFinder = {
    getEntityInstance: jest.fn().mockImplementation((partId) => {
      return {
        id: partId,
        hasComponent: jest.fn().mockImplementation((componentId) => {
          return ['anatomy:part', 'core:description'].includes(componentId);
        }),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'core:description') {
            return { text: `Generated description for ${partId}` };
          }
          if (componentId === 'anatomy:part') {
            const subTypeMap = {
              'head-part-id': 'head',
              'hair-part-id': 'hair',
              'eyes-part-id': 'eyes',
            };
            return { subType: subTypeMap[partId] || 'unknown' };
          }
          return null;
        }),
      };
    }),
  };

  const mockAnatomyFormattingService = {
    getDescriptionOrder: jest
      .fn()
      .mockReturnValue([
        'height',
        'skin_color',
        'build',
        'body_composition',
        'body_hair',
        'smell',
        'head',
        'hair',
        'eyes',
      ]),
    getGroupedParts: jest.fn().mockReturnValue(new Map()),
  };

  const mockPartDescriptionGenerator = {
    generatePartDescription: jest.fn().mockImplementation((partEntity) => {
      return `Generated description for ${partEntity.id}`;
    }),
  };

  const mockEquipmentDescriptionService = {
    generateEquipmentDescription: jest.fn().mockResolvedValue(''),
  };

  return {
    mockBodyPartDescriptionBuilder,
    mockBodyGraphService,
    mockEntityFinder,
    mockAnatomyFormattingService,
    mockPartDescriptionGenerator,
    mockEquipmentDescriptionService,
  };
};

/**
 * Create mocks that simulate performance issues
 */
export const createSlowServiceMocks = () => {
  const baseMocks = createServiceMocks();

  // Add delays to simulate slow operations
  baseMocks.mockBodyGraphService.getAllParts = jest
    .fn()
    .mockImplementation(() => {
      // Simulate slow graph traversal
      const delay = Math.random() * 10;
      return new Promise((resolve) => {
        setTimeout(
          () => resolve(['head-part-id', 'hair-part-id', 'eyes-part-id']),
          delay
        );
      });
    });

  baseMocks.mockPartDescriptionGenerator.generatePartDescription = jest
    .fn()
    .mockImplementation(async (entity) => {
      // Simulate slow description generation
      await new Promise((resolve) => setTimeout(resolve, 5));
      return `Slow generated description for ${entity.id}`;
    });

  return baseMocks;
};

/**
 * Create mocks for error testing scenarios
 */
export const createErrorServiceMocks = () => {
  const mockBodyPartDescriptionBuilder = {
    buildDescription: jest.fn().mockImplementation(() => {
      throw new Error('Description builder error');
    }),
    buildMultipleDescription: jest.fn(),
    getPlural: jest.fn(),
  };

  const mockBodyGraphService = {
    getAllParts: jest.fn().mockImplementation(() => {
      throw new Error('Body graph service error');
    }),
  };

  const mockEntityFinder = {
    getEntityInstance: jest.fn().mockReturnValue(null), // Simulate missing entities
  };

  const mockAnatomyFormattingService = {
    getDescriptionOrder: jest.fn().mockReturnValue([]),
    getGroupedParts: jest.fn(),
  };

  const mockPartDescriptionGenerator = {
    generatePartDescription: jest.fn().mockImplementation(() => {
      throw new Error('Part description generator error');
    }),
  };

  const mockEquipmentDescriptionService = {
    generateEquipmentDescription: jest
      .fn()
      .mockRejectedValue(new Error('Equipment service error')),
  };

  return {
    mockBodyPartDescriptionBuilder,
    mockBodyGraphService,
    mockEntityFinder,
    mockAnatomyFormattingService,
    mockPartDescriptionGenerator,
    mockEquipmentDescriptionService,
  };
};
