/**
 * Expected outputs for various entity configurations in integration tests
 */

export const expectedCompleteDescription = `Height: average
Skin color: olive
Build: athletic
Body composition: lean
Body hair: moderate
Head: Generated description for head-part-id
Hair: Generated description for hair-part-id
Eyes: Generated description for eyes-part-id`;

export const expectedPartialDescription = `Build: average
Body hair: light
Head: Generated description for head-part-id
Hair: Generated description for hair-part-id
Eyes: Generated description for eyes-part-id`;

export const expectedMinimalDescription = `Head: Generated description for head-part-id
Hair: Generated description for hair-part-id
Eyes: Generated description for eyes-part-id`;

export const expectedEdgeCaseDescription = `Body hair: very-hairy
Head: Generated description for head-part-id
Hair: Generated description for hair-part-id
Eyes: Generated description for eyes-part-id`;

/**
 * Expected outputs for specific descriptor values
 */
export const expectedDescriptorValues = {
  build: {
    athletic: `Build: athletic\nHead: Generated description for head-part-id\nHair: Generated description for hair-part-id\nEyes: Generated description for eyes-part-id`,
    average: `Build: average\nHead: Generated description for head-part-id\nHair: Generated description for hair-part-id\nEyes: Generated description for eyes-part-id`,
    stocky: `Build: stocky\nHead: Generated description for head-part-id\nHair: Generated description for hair-part-id\nEyes: Generated description for eyes-part-id`,
    slim: `Build: slim\nHead: Generated description for head-part-id\nHair: Generated description for hair-part-id\nEyes: Generated description for eyes-part-id`,
  },
  bodyComposition: {
    lean: `Body composition: lean\nHead: Generated description for head-part-id\nHair: Generated description for hair-part-id\nEyes: Generated description for eyes-part-id`,
    average: `Body composition: average\nHead: Generated description for head-part-id\nHair: Generated description for hair-part-id\nEyes: Generated description for eyes-part-id`,
    chubby: `Body composition: chubby\nHead: Generated description for head-part-id\nHair: Generated description for hair-part-id\nEyes: Generated description for eyes-part-id`,
    fat: `Body composition: fat\nHead: Generated description for head-part-id\nHair: Generated description for hair-part-id\nEyes: Generated description for eyes-part-id`,
  },
  bodyHair: {
    hairless: `Body hair: hairless\nHead: Generated description for head-part-id\nHair: Generated description for hair-part-id\nEyes: Generated description for eyes-part-id`,
    sparse: `Body hair: sparse\nHead: Generated description for head-part-id\nHair: Generated description for hair-part-id\nEyes: Generated description for eyes-part-id`,
    light: `Body hair: light\nHead: Generated description for head-part-id\nHair: Generated description for hair-part-id\nEyes: Generated description for eyes-part-id`,
    moderate: `Body hair: moderate\nHead: Generated description for head-part-id\nHair: Generated description for hair-part-id\nEyes: Generated description for eyes-part-id`,
    hairy: `Body hair: hairy\nHead: Generated description for head-part-id\nHair: Generated description for hair-part-id\nEyes: Generated description for eyes-part-id`,
    'very-hairy': `Body hair: very-hairy\nHead: Generated description for head-part-id\nHair: Generated description for hair-part-id\nEyes: Generated description for eyes-part-id`,
  },
};

/**
 * Expected descriptor ordering for validation
 */
export const expectedDescriptorOrder = [
  'Height',
  'Skin color',
  'Build',
  'Body composition',
  'Body hair',
  'Head',
  'Hair',
  'Eyes',
];

/**
 * Expected patterns for part descriptions
 */
export const expectedPartDescriptionPatterns = {
  head: /Head: Generated description for head-part-id/,
  hair: /Hair: Generated description for hair-part-id/,
  eyes: /Eyes: Generated description for eyes-part-id/,
};

/**
 * Generate expected output for a given configuration
 *
 * @param config
 */
export const generateExpectedOutput = (config) => {
  const lines = [];

  if (config.build) {
    lines.push(`Build: ${config.build}`);
  }

  if (config.bodyComposition) {
    lines.push(`Body composition: ${config.bodyComposition}`);
  }

  if (config.bodyHair) {
    lines.push(`Body hair: ${config.bodyHair}`);
  }

  if (config.includeParts) {
    config.parts?.forEach((partId) => {
      const partType = partId.replace('-part-id', '');
      const capitalizedType =
        partType.charAt(0).toUpperCase() + partType.slice(1);
      lines.push(`${capitalizedType}: Generated description for ${partId}`);
    });
  }

  return lines.join('\n');
};

/**
 * Performance benchmark expectations
 */
export const performanceExpectations = {
  singleDescription: {
    maxTime: 20, // milliseconds
    avgTime: 10, // milliseconds
  },
  bulkDescriptions: {
    maxTimePerEntity: 25, // milliseconds
    maxTotalTime: 1000, // milliseconds for 10 entities
  },
  memoryUsage: {
    maxGrowth: 50 * 1024 * 1024, // 50MB
  },
};

/**
 * Common test data combinations
 */
export const testDataCombinations = [
  {
    name: 'Athletic lean moderate',
    config: {
      build: 'athletic',
      bodyComposition: 'lean',
      bodyHair: 'moderate',
    },
    expected:
      'Build: athletic\nBody composition: lean\nBody hair: moderate\nHead: Generated description for head-part-id\nHair: Generated description for hair-part-id\nEyes: Generated description for eyes-part-id',
  },
  {
    name: 'Average sparse',
    config: { build: 'average', bodyHair: 'sparse' },
    expected:
      'Build: average\nBody hair: sparse\nHead: Generated description for head-part-id\nHair: Generated description for hair-part-id\nEyes: Generated description for eyes-part-id',
  },
  {
    name: 'Stocky chubby hairy',
    config: { build: 'stocky', bodyComposition: 'chubby', bodyHair: 'hairy' },
    expected:
      'Build: stocky\nBody composition: chubby\nBody hair: hairy\nHead: Generated description for head-part-id\nHair: Generated description for hair-part-id\nEyes: Generated description for eyes-part-id',
  },
  {
    name: 'Slim hairless',
    config: { build: 'slim', bodyHair: 'hairless' },
    expected:
      'Build: slim\nBody hair: hairless\nHead: Generated description for head-part-id\nHair: Generated description for hair-part-id\nEyes: Generated description for eyes-part-id',
  },
];
