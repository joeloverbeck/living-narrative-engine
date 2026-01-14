/**
 * @file ClauseNormalizer - Deterministic clause ID normalization for logic trees.
 */

const COMPARISON_OPERATORS = ['>=', '<=', '>', '<', '=='];
const PREVIOUS_PREFIXES = [
  { previous: 'previousEmotions.', current: 'emotions.' },
  { previous: 'previousMoodAxes.', current: 'moodAxes.' },
  { previous: 'previousSexualStates.', current: 'sexualStates.' },
  { previous: 'previousSexualAxes.', current: 'sexualAxes.' },
  { previous: 'previousAffectTraits.', current: 'affectTraits.' },
];

class ClauseNormalizer {
  /**
   * Normalize a leaf clause into a deterministic id/type pair.
   *
   * @param {object} logic
   * @param {string} path
   * @returns {{ clauseId: string, clauseType: 'threshold' | 'delta' | 'compound' | 'other' }}
   */
  static normalizeLeaf(logic, path) {
    const comparison = ClauseNormalizer.#extractComparison(logic);
    if (comparison) {
      const delta = ClauseNormalizer.#normalizeDelta(comparison);
      if (delta) {
        return delta;
      }

      const threshold = ClauseNormalizer.#normalizeThreshold(comparison);
      if (threshold) {
        return threshold;
      }
    }

    const fallbackType =
      logic && typeof logic === 'object' ? 'compound' : 'other';
    return {
      clauseId: ClauseNormalizer.#fallbackId(path, fallbackType),
      clauseType: fallbackType,
    };
  }

  /**
   * Decompose a max(...) < c clause into per-operand comparisons.
   *
   * @param {object} logic
   * @returns {object[]|null}
   */
  static decomposeMaxClause(logic) {
    const comparison = ClauseNormalizer.#extractComparison(logic);
    if (!comparison) {
      return null;
    }

    const { operator, left, right } = comparison;
    if (
      (operator !== '<' && operator !== '<=') ||
      !left ||
      typeof left !== 'object' ||
      !Array.isArray(left.max) ||
      typeof right !== 'number'
    ) {
      return null;
    }

    return left.max.map((operand) => ({
      [operator]: [operand, right],
    }));
  }

  static #fallbackId(path, type) {
    return `${type}:${path}`;
  }

  static #extractComparison(logic) {
    if (!logic || typeof logic !== 'object') {
      return null;
    }

    for (const op of COMPARISON_OPERATORS) {
      if (logic[op] && Array.isArray(logic[op]) && logic[op].length === 2) {
        const [left, right] = logic[op];

        if (ClauseNormalizer.#isNumber(right)) {
          return { operator: op, left, right };
        }

        if (ClauseNormalizer.#isNumber(left)) {
          return {
            operator: ClauseNormalizer.#reverseOperator(op),
            left: right,
            right: left,
          };
        }
      }
    }

    return null;
  }

  static #normalizeThreshold({ operator, left, right }) {
    const variablePath = ClauseNormalizer.#getVarPath(left);
    if (!variablePath) {
      return null;
    }

    const axisInfo = ClauseNormalizer.#getAxisInfo(variablePath);
    const thresholdValue = ClauseNormalizer.#formatNumber(right);
    const clauseId = axisInfo
      ? `axis:${axisInfo.group}.${axisInfo.axis}:${operator}:${thresholdValue}`
      : `var:${variablePath}:${operator}:${thresholdValue}`;

    return {
      clauseId,
      clauseType: 'threshold',
    };
  }

  static #normalizeDelta({ operator, left, right }) {
    if (!left || typeof left !== 'object' || !Array.isArray(left['-'])) {
      return null;
    }

    const [rawLeft, rawRight] = left['-'];
    const leftVar = ClauseNormalizer.#getVarPath(rawLeft);
    const rightVar = ClauseNormalizer.#getVarPath(rawRight);
    if (!leftVar || !rightVar) {
      return null;
    }

    const leftBase = ClauseNormalizer.#normalizeBasePath(leftVar);
    const rightBase = ClauseNormalizer.#normalizeBasePath(rightVar);
    if (!leftBase || !rightBase || leftBase.basePath !== rightBase.basePath) {
      return null;
    }

    if (leftBase.isPrevious === rightBase.isPrevious) {
      return null;
    }

    let normalizedOperator = operator;
    let normalizedThreshold = right;
    if (leftBase.isPrevious && !rightBase.isPrevious) {
      normalizedOperator = ClauseNormalizer.#negateOperator(operator);
      normalizedThreshold = ClauseNormalizer.#negateNumber(right);
    }

    const thresholdValue = ClauseNormalizer.#formatNumber(normalizedThreshold);
    return {
      clauseId: `delta:${leftBase.basePath}:${normalizedOperator}:${thresholdValue}`,
      clauseType: 'delta',
    };
  }

  static #normalizeBasePath(path) {
    for (const { previous, current } of PREVIOUS_PREFIXES) {
      if (path.startsWith(previous)) {
        return {
          basePath: `${current}${path.slice(previous.length)}`,
          isPrevious: true,
        };
      }
    }

    return { basePath: path, isPrevious: false };
  }

  static #getAxisInfo(variablePath) {
    const axisMatch = variablePath.match(/^(moodAxes|sexualAxes|affectTraits)\.(.+)$/);
    if (!axisMatch) {
      return null;
    }

    return { group: axisMatch[1], axis: axisMatch[2] };
  }

  static #getVarPath(expr) {
    if (expr?.var && typeof expr.var === 'string') {
      return expr.var;
    }
    return null;
  }

  static #isNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  static #formatNumber(value) {
    const normalized = Object.is(value, -0) ? 0 : value;
    return String(normalized);
  }

  static #negateNumber(value) {
    if (!ClauseNormalizer.#isNumber(value)) {
      return value;
    }
    return -value;
  }

  static #reverseOperator(op) {
    const reverseMap = {
      '>=': '<=',
      '<=': '>=',
      '>': '<',
      '<': '>',
      '==': '==',
    };
    return reverseMap[op] || op;
  }

  static #negateOperator(op) {
    const negateMap = {
      '>=': '<=',
      '<=': '>=',
      '>': '<',
      '<': '>',
      '==': '==',
    };
    return negateMap[op] || op;
  }
}

export default ClauseNormalizer;
