/**
 * @file sweepIntegrityUtils - Helpers for sweep integrity checks.
 */

import { REPORT_INTEGRITY_EPSILON } from './reportIntegrityUtils.js';

const BASELINE_THRESHOLD_EPSILON = 1e-3;

const getMonotonicDirection = (operator) => {
  switch (operator) {
    case '>=':
    case '>':
      return 'nonincreasing';
    case '<=':
    case '<':
      return 'nondecreasing';
    default:
      return null;
  }
};

const sortSweepGridByThreshold = (grid) => {
  if (!Array.isArray(grid)) {
    return [];
  }
  return [...grid]
    .filter((point) => typeof point?.threshold === 'number')
    .sort((a, b) => a.threshold - b.threshold);
};

const findBaselineGridPoint = (
  grid,
  originalThreshold,
  epsilon = BASELINE_THRESHOLD_EPSILON
) => {
  if (!Array.isArray(grid) || typeof originalThreshold !== 'number') {
    return null;
  }
  return (
    grid.find(
      (point) =>
        typeof point?.threshold === 'number' &&
        Math.abs(point.threshold - originalThreshold) < epsilon
    ) ?? null
  );
};

const evaluateSweepMonotonicity = ({
  grid,
  rateKey,
  operator,
  epsilon = REPORT_INTEGRITY_EPSILON,
}) => {
  const direction = getMonotonicDirection(operator);
  const sortedGrid = sortSweepGridByThreshold(grid);

  if (!direction || sortedGrid.length < 2) {
    return {
      direction,
      isMonotonic: true,
      violations: [],
      sortedGrid,
    };
  }

  const violations = [];
  let previous = sortedGrid[0];

  for (let i = 1; i < sortedGrid.length; i++) {
    const current = sortedGrid[i];
    const prevRate = previous?.[rateKey];
    const currentRate = current?.[rateKey];

    if (typeof prevRate !== 'number' || typeof currentRate !== 'number') {
      previous = current;
      continue;
    }

    if (direction === 'nonincreasing' && currentRate > prevRate + epsilon) {
      violations.push({
        fromThreshold: previous.threshold,
        toThreshold: current.threshold,
        fromRate: prevRate,
        toRate: currentRate,
      });
    }

    if (direction === 'nondecreasing' && currentRate < prevRate - epsilon) {
      violations.push({
        fromThreshold: previous.threshold,
        toThreshold: current.threshold,
        fromRate: prevRate,
        toRate: currentRate,
      });
    }

    previous = current;
  }

  return {
    direction,
    isMonotonic: violations.length === 0,
    violations,
    sortedGrid,
  };
};

export {
  evaluateSweepMonotonicity,
  findBaselineGridPoint,
  getMonotonicDirection,
  sortSweepGridByThreshold,
};
