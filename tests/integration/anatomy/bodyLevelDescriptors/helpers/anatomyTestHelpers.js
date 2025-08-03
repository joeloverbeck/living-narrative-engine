import { BodyDescriptionComposer } from '../../../../../src/anatomy/bodyDescriptionComposer.js';
import {
  createServiceMocks,
  createRealisticServiceMocks,
} from '../fixtures/serviceMocks.js';

/**
 * Create a fully configured BodyDescriptionComposer with mocked dependencies
 *
 * @param overrides
 */
export const createFullComposer = (overrides = {}) => {
  const mocks = createServiceMocks();

  // Allow override of any mock
  const dependencies = {
    bodyPartDescriptionBuilder:
      overrides.bodyPartDescriptionBuilder ||
      mocks.mockBodyPartDescriptionBuilder,
    bodyGraphService: overrides.bodyGraphService || mocks.mockBodyGraphService,
    entityFinder: overrides.entityFinder || mocks.mockEntityFinder,
    anatomyFormattingService:
      overrides.anatomyFormattingService || mocks.mockAnatomyFormattingService,
    partDescriptionGenerator:
      overrides.partDescriptionGenerator || mocks.mockPartDescriptionGenerator,
    equipmentDescriptionService:
      overrides.equipmentDescriptionService ||
      mocks.mockEquipmentDescriptionService,
  };

  return new BodyDescriptionComposer(dependencies);
};

/**
 * Create a BodyDescriptionComposer with realistic mocks for more thorough testing
 *
 * @param overrides
 */
export const createRealisticComposer = (overrides = {}) => {
  const mocks = createRealisticServiceMocks();

  const dependencies = {
    bodyPartDescriptionBuilder:
      overrides.bodyPartDescriptionBuilder ||
      mocks.mockBodyPartDescriptionBuilder,
    bodyGraphService: overrides.bodyGraphService || mocks.mockBodyGraphService,
    entityFinder: overrides.entityFinder || mocks.mockEntityFinder,
    anatomyFormattingService:
      overrides.anatomyFormattingService || mocks.mockAnatomyFormattingService,
    partDescriptionGenerator:
      overrides.partDescriptionGenerator || mocks.mockPartDescriptionGenerator,
    equipmentDescriptionService:
      overrides.equipmentDescriptionService ||
      mocks.mockEquipmentDescriptionService,
  };

  return new BodyDescriptionComposer(dependencies);
};

/**
 * Compare descriptions ignoring whitespace differences
 *
 * @param description
 */
export const normalizeDescription = (description) => {
  return description
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
};

/**
 * Extract descriptor values from description
 *
 * @param description
 */
export const extractDescriptorValues = (description) => {
  const values = {};
  const lines = description.split('\n');

  lines.forEach((line) => {
    const match = line.match(/^(.+?):\s+(.+)$/);
    if (match) {
      values[match[1]] = match[2];
    }
  });

  return values;
};

/**
 * Validate descriptor ordering
 *
 * @param description
 * @param expectedOrder
 */
export const validateDescriptorOrder = (description, expectedOrder) => {
  const lines = description.split('\n').filter((line) => line.trim());
  const actualOrder = lines
    .map((line) => {
      const match = line.match(/^(.+?):/);
      return match ? match[1] : null;
    })
    .filter(Boolean);

  return {
    matches: JSON.stringify(actualOrder) === JSON.stringify(expectedOrder),
    actual: actualOrder,
    expected: expectedOrder,
  };
};

/**
 * Check if description contains expected descriptor patterns
 *
 * @param description
 * @param patterns
 */
export const validateDescriptorPatterns = (description, patterns) => {
  const results = {};

  Object.entries(patterns).forEach(([key, pattern]) => {
    results[key] = pattern.test(description);
  });

  return results;
};

/**
 * Count the number of descriptors in a description
 *
 * @param description
 */
export const countDescriptors = (description) => {
  const lines = description.split('\n').filter((line) => line.trim());
  return lines.filter((line) => line.includes(':')).length;
};

/**
 * Extract only the descriptor lines from a description
 *
 * @param description
 */
export const extractDescriptorLines = (description) => {
  return description
    .split('\n')
    .filter((line) => line.trim() && line.includes(':'))
    .map((line) => line.trim());
};

/**
 * Extract only the part description lines from a description
 *
 * @param description
 */
export const extractPartDescriptionLines = (description) => {
  return description
    .split('\n')
    .filter(
      (line) =>
        line.trim() &&
        line.includes(':') &&
        !line.includes('Build:') &&
        !line.includes('Body composition:') &&
        !line.includes('Body hair:')
    )
    .map((line) => line.trim());
};

/**
 * Create a matcher for Jest that validates descriptor format
 */
export const descriptorMatcher = {
  toHaveValidDescriptorFormat(received) {
    const lines = received.split('\n').filter((line) => line.trim());
    const descriptorLines = lines.filter((line) => line.includes(':'));

    const invalidLines = descriptorLines.filter((line) => {
      const match = line.match(/^(.+?):\s+(.+)$/);
      return !match || !match[1].trim() || !match[2].trim();
    });

    if (invalidLines.length === 0) {
      return {
        message: () => `Expected description to have invalid descriptor format`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `Expected description to have valid descriptor format, but found invalid lines: ${invalidLines.join(', ')}`,
        pass: false,
      };
    }
  },
};

/**
 * Measure execution time of an async function
 *
 * @param fn
 */
export const measureExecutionTime = async (fn) => {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  return {
    result,
    duration,
  };
};

/**
 * Run a function multiple times and collect performance metrics
 *
 * @param fn
 * @param iterations
 */
export const collectPerformanceMetrics = async (fn, iterations = 100) => {
  const results = [];

  for (let i = 0; i < iterations; i++) {
    const { duration } = await measureExecutionTime(fn);
    results.push(duration);
  }

  const total = results.reduce((sum, time) => sum + time, 0);
  const average = total / iterations;
  const min = Math.min(...results);
  const max = Math.max(...results);

  return {
    total,
    average,
    min,
    max,
    iterations,
    results,
  };
};

/**
 * Simulate memory pressure testing
 *
 * @param fn
 * @param iterations
 */
export const simulateMemoryPressure = async (fn, iterations = 100) => {
  const initialMemory = process.memoryUsage().heapUsed;

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  const startMemory = process.memoryUsage().heapUsed;

  for (let i = 0; i < iterations; i++) {
    await fn();
  }

  if (global.gc) {
    global.gc();
  }

  const endMemory = process.memoryUsage().heapUsed;
  const memoryGrowth = endMemory - startMemory;

  return {
    initialMemory,
    startMemory,
    endMemory,
    memoryGrowth,
    memoryGrowthMB: memoryGrowth / 1024 / 1024,
  };
};

/**
 * Create test data for comprehensive testing
 *
 * @param baseEntity
 * @param variations
 */
export const createTestSuite = (baseEntity, variations) => {
  return variations.map((variation) => ({
    name: variation.name,
    entity: {
      ...baseEntity,
      id: `${baseEntity.id}-${variation.name}`,
      getComponentData: jest.fn().mockImplementation((componentId) => {
        const baseData = baseEntity.getComponentData(componentId);
        return variation.overrides?.[componentId] || baseData;
      }),
    },
    expected: variation.expected,
  }));
};

/**
 * Validate that all required acceptance criteria are met
 *
 * @param description
 * @param entity
 * @param composer
 */
export const validateAcceptanceCriteria = (description, entity, composer) => {
  const criteria = {
    hasBodyLevelDescriptors: false,
    hasCorrectOrdering: false,
    handlesPartialData: false,
    includesPartDescriptions: false,
    gracefulErrorHandling: false,
  };

  // Check for body-level descriptors
  const descriptorLines = extractDescriptorLines(description);
  criteria.hasBodyLevelDescriptors = descriptorLines.some(
    (line) =>
      line.includes('Build:') ||
      line.includes('Body composition:') ||
      line.includes('Body hair:')
  );

  // Check ordering - should validate that present descriptors are in correct relative order
  const bodyDescriptors = descriptorLines.filter(
    (line) =>
      line.includes('Build:') ||
      line.includes('Body composition:') ||
      line.includes('Body hair:')
  );
  const expectedBodyOrder = ['Build', 'Body composition', 'Body hair'];
  const actualBodyOrder = bodyDescriptors.map((line) => line.split(':')[0]);

  // Check if the body descriptors that are present are in the right relative order
  criteria.hasCorrectOrdering =
    bodyDescriptors.length <= 1 ||
    actualBodyOrder.every((descriptor, index) => {
      const expectedIndex = expectedBodyOrder.indexOf(descriptor);
      const nextExpectedIndex =
        index + 1 < actualBodyOrder.length
          ? expectedBodyOrder.indexOf(actualBodyOrder[index + 1])
          : Infinity;
      return expectedIndex < nextExpectedIndex;
    });

  // Check for part descriptions
  const partLines = extractPartDescriptionLines(description);
  criteria.includesPartDescriptions = partLines.length > 0;

  // Additional validation would require more context about the specific entity and expected behavior

  return criteria;
};
