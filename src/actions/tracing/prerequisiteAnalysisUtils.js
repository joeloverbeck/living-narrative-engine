/**
 * @file Utility functions for prerequisite analysis in action tracing
 */

/**
 * Analyze prerequisite structure and complexity
 *
 * @param {Array | object} prerequisites - Prerequisites to analyze
 * @returns {object} Detailed prerequisite analysis
 */
export function analyzePrerequisiteStructure(prerequisites) {
  if (!prerequisites) {
    return {
      hasPrerequisites: false,
      complexity: 'none',
      count: 0,
      types: [],
    };
  }

  const analysis = {
    hasPrerequisites: true,
    count: 0,
    types: [],
    complexity: 'simple',
    structure: 'unknown',
    nestedLevels: 0,
  };

  if (Array.isArray(prerequisites)) {
    analysis.structure = 'array';
    analysis.count = prerequisites.length;

    // Analyze each prerequisite
    const complexityScores = [];
    prerequisites.forEach((prereq) => {
      const prereqAnalysis = analyzePrerequisiteItem(prereq);
      analysis.types.push(prereqAnalysis.type);
      complexityScores.push(prereqAnalysis.complexityScore);
      analysis.nestedLevels = Math.max(
        analysis.nestedLevels,
        prereqAnalysis.nestedLevels
      );
    });

    // Determine overall complexity
    const avgComplexity =
      complexityScores.reduce((sum, score) => sum + score, 0) /
      complexityScores.length;
    analysis.complexity = getComplexityLevel(
      avgComplexity,
      analysis.nestedLevels
    );
  } else if (typeof prerequisites === 'object') {
    analysis.structure = 'object';
    analysis.count = 1;

    const prereqAnalysis = analyzePrerequisiteItem(prerequisites);
    analysis.types = [prereqAnalysis.type];
    analysis.complexity = getComplexityLevel(
      prereqAnalysis.complexityScore,
      prereqAnalysis.nestedLevels
    );
    analysis.nestedLevels = prereqAnalysis.nestedLevels;
  } else {
    analysis.structure = 'primitive';
    analysis.count = 1;
    analysis.types = [typeof prerequisites];
  }

  return analysis;
}

/**
 * Analyze individual prerequisite item
 *
 * @private
 * @param {*} prereq - Prerequisite item to analyze
 * @returns {object} Analysis of individual prerequisite
 */
function analyzePrerequisiteItem(prereq) {
  const analysis = {
    type: typeof prereq,
    complexityScore: 0,
    nestedLevels: 0,
  };

  if (typeof prereq === 'object' && prereq !== null) {
    // Check if it's a JSON Logic expression
    if (isJsonLogicExpression(prereq)) {
      analysis.type = 'json-logic';
      analysis.complexityScore = calculateJsonLogicComplexity(prereq);
      analysis.nestedLevels = calculateNestedLevels(prereq);
    } else {
      analysis.type = 'object';
      analysis.complexityScore = Object.keys(prereq).length * 0.5;
      analysis.nestedLevels = calculateObjectNesting(prereq);
    }
  } else {
    analysis.complexityScore = 0.1; // Simple primitive
  }

  return analysis;
}

/**
 * Check if object is a JSON Logic expression
 *
 * @private
 * @param {object} obj - Object to check
 * @returns {boolean}
 */
function isJsonLogicExpression(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  // Common JSON Logic operators
  const jsonLogicOperators = [
    '==',
    '!=',
    '===',
    '!==',
    '>',
    '<',
    '>=',
    '<=',
    'and',
    'or',
    'not',
    '!',
    'if',
    'in',
    'var',
    '+',
    '-',
    '*',
    '/',
    '%',
    'map',
    'filter',
    'reduce',
    'all',
    'some',
    'none',
    'merge',
    'cat',
  ];

  return jsonLogicOperators.some((op) => obj.hasOwnProperty(op));
}

/**
 * Calculate JSON Logic expression complexity
 *
 * @private
 * @param {object} expression - JSON Logic expression
 * @returns {number} Complexity score
 */
function calculateJsonLogicComplexity(expression) {
  let complexity = 1; // Base complexity

  for (const [operator, operand] of Object.entries(expression)) {
    // Operator complexity weights
    const operatorWeights = {
      '==': 1,
      '!=': 1,
      '===': 1,
      '!==': 1,
      '>': 1,
      '<': 1,
      '>=': 1,
      '<=': 1,
      and: 2,
      or: 2,
      not: 1,
      if: 3,
      in: 2,
      var: 0.5,
      '+': 1,
      '-': 1,
      '*': 1,
      '/': 1,
      '%': 1,
      map: 4,
      filter: 4,
      reduce: 5,
      all: 3,
      some: 3,
      none: 3,
    };

    complexity += operatorWeights[operator] || 2; // Default weight for unknown operators

    // Add complexity for nested expressions
    if (Array.isArray(operand)) {
      operand.forEach((item) => {
        if (
          typeof item === 'object' &&
          item !== null &&
          isJsonLogicExpression(item)
        ) {
          complexity += calculateJsonLogicComplexity(item) * 0.8; // Nested expressions are weighted
        }
      });
    } else if (
      typeof operand === 'object' &&
      operand !== null &&
      isJsonLogicExpression(operand)
    ) {
      complexity += calculateJsonLogicComplexity(operand) * 0.8;
    }
  }

  return complexity;
}

/**
 * Calculate nested levels in JSON Logic expression
 *
 * @private
 * @param {object} expression - JSON Logic expression
 * @returns {number} Maximum nesting depth
 */
function calculateNestedLevels(expression) {
  let maxDepth = 1;

  for (const operand of Object.values(expression)) {
    if (Array.isArray(operand)) {
      operand.forEach((item) => {
        if (
          typeof item === 'object' &&
          item !== null &&
          isJsonLogicExpression(item)
        ) {
          maxDepth = Math.max(maxDepth, 1 + calculateNestedLevels(item));
        }
      });
    } else if (
      typeof operand === 'object' &&
      operand !== null &&
      isJsonLogicExpression(operand)
    ) {
      maxDepth = Math.max(maxDepth, 1 + calculateNestedLevels(operand));
    }
  }

  return maxDepth;
}

/**
 * Calculate object nesting depth
 *
 * @private
 * @param {object} obj - Object to analyze
 * @returns {number} Nesting depth
 */
function calculateObjectNesting(obj) {
  let maxDepth = 1;

  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      maxDepth = Math.max(maxDepth, 1 + calculateObjectNesting(value));
    }
  }

  return maxDepth;
}

/**
 * Determine complexity level from score and nesting
 *
 * @private
 * @param {number} score - Complexity score
 * @param {number} nesting - Nesting depth
 * @returns {string} Complexity level
 */
function getComplexityLevel(score, nesting) {
  if (score <= 1 && nesting <= 1) return 'simple';
  if (score <= 3 && nesting <= 2) return 'moderate';
  if (score <= 6 && nesting <= 3) return 'complex';
  return 'very-complex';
}

/**
 * Generate human-readable prerequisite report
 *
 * @param {object} analysis - Result from analyzePrerequisiteStructure
 * @returns {string} Human-readable report
 */
export function generatePrerequisiteReport(analysis) {
  if (!analysis.hasPrerequisites) {
    return 'No prerequisites defined - action available to all actors';
  }

  let report = `Prerequisite Analysis:\n`;
  report += `- Structure: ${analysis.structure}\n`;
  report += `- Count: ${analysis.count}\n`;
  report += `- Complexity: ${analysis.complexity}\n`;
  report += `- Nesting Levels: ${analysis.nestedLevels}\n`;

  if (analysis.types.length > 0) {
    const typeCounts = analysis.types.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    report += `- Types: ${Object.entries(typeCounts)
      .map(([type, count]) => `${type}(${count})`)
      .join(', ')}\n`;
  }

  return report;
}

/**
 * Validate prerequisite trace data
 *
 * @param {object} traceData - Prerequisite trace data to validate
 * @returns {object} Validation result
 */
export function validatePrerequisiteTraceData(traceData) {
  const issues = [];
  const warnings = [];

  if (!traceData.actorId) {
    issues.push('Missing actorId in prerequisite trace data');
  }

  if (typeof traceData.hasPrerequisites !== 'boolean') {
    issues.push('hasPrerequisites must be a boolean');
  }

  if (typeof traceData.evaluationPassed !== 'boolean') {
    issues.push('evaluationPassed must be a boolean');
  }

  if (traceData.hasPrerequisites && !traceData.prerequisites) {
    warnings.push(
      'Action marked as having prerequisites but no prerequisite data provided'
    );
  }

  if (traceData.evaluationDetails) {
    if (typeof traceData.evaluationDetails.prerequisiteCount !== 'number') {
      warnings.push('evaluationDetails.prerequisiteCount should be a number');
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
  };
}

/**
 * Extract prerequisite failure reasons from evaluation details
 *
 * @param {object} evaluationDetails - Detailed evaluation results
 * @returns {Array<string>} Array of failure reasons
 */
export function extractFailureReasons(evaluationDetails) {
  const reasons = [];

  if (!evaluationDetails || evaluationDetails.evaluationPassed) {
    return reasons;
  }

  if (evaluationDetails.jsonLogicTraces) {
    evaluationDetails.jsonLogicTraces.forEach((trace, index) => {
      if (trace.result === false) {
        reasons.push(`JSON Logic expression ${index + 1} evaluated to false`);
      }
    });
  }

  if (evaluationDetails.error) {
    reasons.push(`Evaluation error: ${evaluationDetails.error}`);
  }

  if (reasons.length === 0) {
    reasons.push('Prerequisites failed for unknown reason');
  }

  return reasons;
}
