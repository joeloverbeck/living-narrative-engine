/**
 * @file PCA (Principal Component Analysis) Service for axis gap analysis.
 * @description Performs dimensionality reduction and variance analysis on prototype weights.
 */

import {
  computeMedian,
  countSignificantComponentsBrokenStick,
} from '../../utils/statisticalUtils.js';
import { ALL_PROTOTYPE_WEIGHT_AXES } from '../../../constants/prototypeAxisConstants.js';
import GateConstraint from '../../models/GateConstraint.js';

/**
 * @typedef {object} PCAResult
 * @property {number} residualVarianceRatio - Ratio of unexplained variance.
 * @property {number} additionalSignificantComponents - Components beyond expected with significant variance (alias for significantBeyondExpected).
 * @property {number} significantComponentCount - Total significant components (broken-stick count).
 * @property {number} expectedComponentCount - Expected component count (median active axes K).
 * @property {number} significantBeyondExpected - Components beyond expected (significantCount - expectedCount).
 * @property {number} axisCount - Dynamic K value (median active axes per prototype) used for residual calculation.
 * @property {Array<{prototypeId: string, loading: number}>} topLoadingPrototypes - Top 10 extreme prototypes.
 * @property {string[]} dimensionsUsed - Axes included in analysis.
 * @property {string[]} excludedSparseAxes - Axes excluded due to low usage (below pcaMinAxisUsageRatio threshold).
 * @property {string[]} unusedDefinedAxes - Axes defined in ALL_PROTOTYPE_WEIGHT_AXES but not used by any prototype.
 * @property {string[]} unusedInGates - Axes used in prototype weights but not referenced in any prototype gates.
 * @property {number[]} cumulativeVariance - Cumulative variance explained per component.
 * @property {number[]} explainedVariance - Individual variance explained per component (ratio 0-1).
 * @property {number} componentsFor80Pct - Components needed for 80% variance.
 * @property {number} componentsFor90Pct - Components needed for 90% variance.
 * @property {Array<{prototypeId: string, error: number}>} reconstructionErrors - Top 5 worst-fitting prototypes.
 * @property {Record<string, number>|null} residualEigenvector - First eigenvector beyond expected, mapped to axis names (null if none).
 * @property {number} residualEigenvectorIndex - Index of residual eigenvector (-1 if none).
 */

/**
 * Service for performing Principal Component Analysis on prototype weight matrices.
 */
export class PCAAnalysisService {
  #config;

  /**
   * Create a PCAAnalysisService.
   *
   * @param {object} [config] - Configuration options.
   * @param {number} [config.pcaKaiserThreshold] - Minimum eigenvalue for significance (default: 1.0).
   * @param {number} [config.activeAxisEpsilon] - Minimum weight magnitude for active axis (default: 0).
   * @param {'broken-stick'|'kaiser'} [config.pcaComponentSignificanceMethod] - Method for component significance (default: 'broken-stick').
   * @param {number} [config.pcaMinAxisUsageRatio] - Minimum fraction of prototypes that must use an axis for PCA inclusion (default: 0.1).
   */
  /**
   * Create a PCAAnalysisService.
   *
   * @param {object} [config] - Configuration options.
   * @param {number} [config.pcaKaiserThreshold] - Minimum eigenvalue for significance (default: 1.0).
   * @param {number} [config.activeAxisEpsilon] - Minimum weight magnitude for active axis (default: 0).
   * @param {'broken-stick'|'kaiser'} [config.pcaComponentSignificanceMethod] - Method for component significance (default: 'broken-stick').
   * @param {number} [config.pcaMinAxisUsageRatio] - Minimum fraction of prototypes that must use an axis for PCA inclusion (default: 0.1).
   * @param {'center-only'|'z-score'} [config.pcaNormalizationMethod] - Normalization method for PCA (default: 'center-only').
   * @param {'variance-80'|'variance-90'|'broken-stick'|'median-active'} [config.pcaExpectedDimensionMethod] - Method for computing expected dimensionality K (default: 'variance-80').
   * @param {number} [config.jacobiConvergenceTolerance] - Jacobi eigendecomposition convergence tolerance (default: 1e-10).
   * @param {number|null} [config.jacobiMaxIterationsOverride] - Override for Jacobi max iterations (default: null, uses 50*n²).
   */
  constructor(config = {}) {
    this.#config = {
      pcaKaiserThreshold: config.pcaKaiserThreshold ?? 1.0,
      activeAxisEpsilon: config.activeAxisEpsilon ?? 0,
      pcaComponentSignificanceMethod:
        config.pcaComponentSignificanceMethod ?? 'broken-stick',
      pcaMinAxisUsageRatio: config.pcaMinAxisUsageRatio ?? 0.1,
      pcaNormalizationMethod: config.pcaNormalizationMethod ?? 'center-only',
      pcaExpectedDimensionMethod:
        config.pcaExpectedDimensionMethod ?? 'variance-80',
      jacobiConvergenceTolerance: config.jacobiConvergenceTolerance ?? 1e-10,
      jacobiMaxIterationsOverride: config.jacobiMaxIterationsOverride ?? null,
    };
  }

  /**
   * Perform PCA analysis on prototypes.
   *
   * @param {Array<{id?: string, prototypeId?: string, weights?: Record<string, number>}>} prototypes - Prototype objects.
   * @returns {PCAResult} PCA analysis results.
   */
  analyze(prototypes) {
    if (!Array.isArray(prototypes) || prototypes.length < 2) {
      return this.#createEmptyResult();
    }

    const { matrix, axes, prototypeIds, excludedSparseAxes, unusedDefinedAxes } =
      this.#buildWeightMatrix(prototypes);

    // Extract gate axes to compute weight-gate mismatch
    const gateAxes = this.#extractGateAxes(prototypes);
    // Axes used in weights (axes from buildWeightMatrix) but not in any gates
    const unusedInGates = axes.filter((axis) => !gateAxes.has(axis)).sort();

    // Partition unusedDefinedAxes into gate-only vs truly unused
    const unusedDefinedUsedInGates = unusedDefinedAxes.filter((axis) =>
      gateAxes.has(axis)
    );
    const unusedDefinedNotInGates = unusedDefinedAxes.filter(
      (axis) => !gateAxes.has(axis)
    );

    if (axes.length === 0 || matrix.length < 2) {
      return this.#createEmptyResult(excludedSparseAxes, unusedDefinedAxes, unusedInGates, unusedDefinedUsedInGates, unusedDefinedNotInGates);
    }

    const hasNonZero = matrix.some((row) =>
      row.some((value) => Math.abs(value) > 0)
    );
    if (!hasNonZero) {
      return this.#createEmptyResult(excludedSparseAxes, unusedDefinedAxes, unusedInGates, unusedDefinedUsedInGates, unusedDefinedNotInGates);
    }

    const normalized = this.#normalizeMatrix(matrix);
    if (!normalized.hasVariance) {
      return this.#createEmptyResult(excludedSparseAxes, unusedDefinedAxes, unusedInGates, unusedDefinedUsedInGates, unusedDefinedNotInGates);
    }

    const covariance = this.#computeCovariance(normalized.matrix);
    if (!covariance || covariance.length === 0) {
      return this.#createEmptyResult(excludedSparseAxes, unusedDefinedAxes, unusedInGates, unusedDefinedUsedInGates, unusedDefinedNotInGates);
    }

    const eigen = this.#computeEigenDecomposition(covariance);
    if (!eigen || eigen.values.length === 0) {
      return this.#createEmptyResult(excludedSparseAxes, unusedDefinedAxes, unusedInGates, unusedDefinedUsedInGates, unusedDefinedNotInGates);
    }

    const totalVariance = eigen.values.reduce((sum, value) => sum + value, 0);
    if (totalVariance <= 0) {
      return this.#createEmptyResult(excludedSparseAxes, unusedDefinedAxes, unusedInGates, unusedDefinedUsedInGates, unusedDefinedNotInGates);
    }

    // Compute cumulative variance from eigenvalues (needed for variance-based K methods)
    const cumulativeVariance = [];
    let cumulative = 0;
    for (const eigenvalue of eigen.values) {
      cumulative += eigenvalue;
      cumulativeVariance.push(cumulative / totalVariance);
    }

    // Compute individual variance proportions from eigenvalues
    const explainedVariance = eigen.values.map(
      (eigenvalue) => eigenvalue / totalVariance
    );

    // Find component counts for 80% and 90% thresholds
    const componentsFor80Pct =
      cumulativeVariance.findIndex((v) => v >= 0.8) + 1 || axes.length;
    const componentsFor90Pct =
      cumulativeVariance.findIndex((v) => v >= 0.9) + 1 || axes.length;

    // Compute expected axis count using configured method
    const axisCount = this.#computeExpectedAxisCount({
      prototypes,
      axes,
      eigenvalues: eigen.values,
      totalVariance,
      componentsFor80Pct,
      componentsFor90Pct,
    });

    const residualValues = eigen.values.slice(axisCount);
    const residualVariance = residualValues.reduce((sum, value) => sum + value, 0);
    const residualVarianceRatio = Math.min(
      1,
      Math.max(0, residualVariance / totalVariance)
    );
    const { significantComponentCount, significantBeyondExpected } =
      this.#computeSignificantComponentMetrics(
        eigen.values,
        totalVariance,
        axisCount
      );
    // Alias for backward compatibility
    const additionalSignificantComponents = significantBeyondExpected;
    const topLoadingPrototypes = this.#computeExtremePrototypes({
      axisCount,
      eigenvectors: eigen.vectors,
      matrix: normalized.matrix,
      prototypeIds,
    });

    // Compute reconstruction errors for prototypes
    const reconstructionErrors = this.#computeReconstructionErrors({
      matrix: normalized.matrix,
      eigenvectors: eigen.vectors,
      axisCount,
      prototypeIds,
      prototypes,
      excludedSparseAxes,
    });

    // Extract residual eigenvector (first component beyond expected K)
    let residualEigenvector = null;
    let residualEigenvectorIndex = -1;
    if (axisCount < eigen.vectors.length) {
      residualEigenvectorIndex = axisCount;
      residualEigenvector = this.#buildResidualEigenvector(
        eigen.vectors[axisCount],
        axes
      );
    }

    return {
      residualVarianceRatio,
      additionalSignificantComponents,
      significantComponentCount,
      expectedComponentCount: axisCount,
      significantBeyondExpected,
      axisCount,
      topLoadingPrototypes,
      dimensionsUsed: axes,
      excludedSparseAxes,
      unusedDefinedAxes,
      unusedDefinedUsedInGates,
      unusedDefinedNotInGates,
      unusedInGates,
      cumulativeVariance,
      explainedVariance,
      componentsFor80Pct,
      componentsFor90Pct,
      reconstructionErrors,
      residualEigenvector,
      residualEigenvectorIndex,
    };
  }

  /**
   * Perform PCA analysis with a two-pass comparison: dense (sparse-filtered) vs full (unfiltered).
   *
   * Runs the standard analyze() on the sparse-filtered matrix, then a second pass with
   * sparse filtering disabled (pcaMinAxisUsageRatio = 0) on the full matrix. Returns both
   * results plus comparison metrics showing the impact of sparse filtering.
   *
   * @param {Array<{id?: string, prototypeId?: string, weights?: Record<string, number>}>} prototypes - Prototype objects.
   * @returns {{dense: PCAResult, full: PCAResult, comparison: {deltaSignificant: number, deltaResidualVariance: number, deltaRMSE: number, filteringImpactSummary: string}}} Two-pass comparison results.
   */
  analyzeWithComparison(prototypes) {
    const dense = this.analyze(prototypes);

    // Run second pass with sparse filtering disabled
    const fullConfig = { ...this.#config, pcaMinAxisUsageRatio: 0 };
    const fullService = new PCAAnalysisService(fullConfig);
    const full = fullService.analyze(prototypes);

    // Compute comparison deltas
    const deltaSignificant =
      full.significantComponentCount - dense.significantComponentCount;
    const deltaResidualVariance =
      full.residualVarianceRatio - dense.residualVarianceRatio;

    // Compute delta RMSE from reconstruction errors
    const denseRMSE = this.#computeAverageRMSE(dense.reconstructionErrors);
    const fullRMSE = this.#computeAverageRMSE(full.reconstructionErrors);
    const deltaRMSE = fullRMSE - denseRMSE;

    // Summarize filtering impact
    const materialThreshold = 0.02;
    const materialChange =
      Math.abs(deltaResidualVariance) > materialThreshold ||
      Math.abs(deltaSignificant) > 0;
    const filteringImpactSummary = materialChange
      ? 'Sparse filtering materially changed PCA conclusions.'
      : 'Sparse filtering did not materially change PCA conclusions.';

    return {
      dense,
      full,
      comparison: {
        deltaSignificant,
        deltaResidualVariance,
        deltaRMSE,
        filteringImpactSummary,
      },
    };
  }

  /**
   * Compute average RMSE from reconstruction errors array.
   *
   * @private
   * @param {Array<{prototypeId: string, error: number}>} errors - Reconstruction errors.
   * @returns {number} Average RMSE (0 if empty).
   */
  #computeAverageRMSE(errors) {
    if (!errors || errors.length === 0) return 0;
    const sum = errors.reduce((acc, e) => acc + e.error, 0);
    return sum / errors.length;
  }

  /**
   * Create an empty PCA result.
   *
   * @param {string[]} [excludedSparseAxes] - Axes excluded due to sparse usage.
   * @param {string[]} [unusedDefinedAxes] - Axes defined but not used by any prototype.
   * @param {string[]} [unusedInGates] - Axes in weights but not in any gates.
   * @param {string[]} [unusedDefinedUsedInGates] - Defined axes not in weights but referenced in gates.
   * @param {string[]} [unusedDefinedNotInGates] - Defined axes not in weights and not in gates.
   * @returns {PCAResult} Empty result object.
   */
  #createEmptyResult(excludedSparseAxes = [], unusedDefinedAxes = [], unusedInGates = [], unusedDefinedUsedInGates = [], unusedDefinedNotInGates = []) {
    return {
      residualVarianceRatio: 0,
      additionalSignificantComponents: 0,
      significantComponentCount: 0,
      expectedComponentCount: 0,
      significantBeyondExpected: 0,
      axisCount: 0,
      topLoadingPrototypes: [],
      dimensionsUsed: [],
      excludedSparseAxes,
      unusedDefinedAxes,
      unusedDefinedUsedInGates,
      unusedDefinedNotInGates,
      unusedInGates,
      cumulativeVariance: [],
      explainedVariance: [],
      componentsFor80Pct: 0,
      componentsFor90Pct: 0,
      reconstructionErrors: [],
      residualEigenvector: null,
      residualEigenvectorIndex: -1,
    };
  }

  /**
   * Extract all unique axis names referenced in prototype gates.
   *
   * Parses gate strings like "valence >= 0.35" to extract axis names.
   * Used to compute unusedInGates (axes in weights but not in gates).
   *
   * @param {Array} prototypes - Prototype objects with gates arrays.
   * @returns {Set<string>} Set of unique axis names found in gates.
   */
  #extractGateAxes(prototypes) {
    const gateAxes = new Set();

    for (const proto of prototypes) {
      const gates = proto?.gates;
      if (!Array.isArray(gates)) continue;

      for (const gateStr of gates) {
        if (typeof gateStr !== 'string') continue;
        try {
          const gateConstraint = GateConstraint.parse(gateStr);
          gateAxes.add(gateConstraint.axis);
        } catch {
          // Skip unparseable gates
          continue;
        }
      }
    }

    return gateAxes;
  }

  /**
   * Build the weight matrix from prototypes.
   *
   * @param {Array} prototypes - Prototype objects.
   * @returns {{matrix: number[][], axes: string[], prototypeIds: string[], excludedSparseAxes: string[], unusedDefinedAxes: string[]}} Matrix data.
   */
  #buildWeightMatrix(prototypes) {
    const axisSet = new Set();

    prototypes.forEach((prototype) => {
      const weights = prototype?.weights;
      if (!weights || typeof weights !== 'object') {
        return;
      }
      for (const [axis, value] of Object.entries(weights)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          axisSet.add(axis);
        }
      }
    });

    let axes = Array.from(axisSet).sort();

    // Compute unused defined axes: axes in the registry but not used by any prototype
    // This captures axes with 0% usage (different from sparse axes with 1-9% usage)
    const unusedDefinedAxes = ALL_PROTOTYPE_WEIGHT_AXES.filter(
      (axis) => !axisSet.has(axis)
    );

    // Filter sparse axes before variance selection to avoid z-score inflation
    const minUsageRatio = this.#config.pcaMinAxisUsageRatio;
    const { included: denseAxes, excluded: excludedSparseAxes } =
      this.#filterSparseAxes(prototypes, axes, minUsageRatio);
    axes = denseAxes;

    const axisLimit = Math.min(axes.length, prototypes.length);

    if (axes.length > axisLimit) {
      axes = this.#selectTopVarianceAxes(prototypes, axes, axisLimit);
    }

    const matrix = prototypes.map((prototype) => {
      const weights = prototype?.weights ?? {};
      return axes.map((axis) => {
        const value = weights[axis];
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
      });
    });
    const prototypeIds = prototypes.map(
      (prototype, index) =>
        prototype?.id ?? prototype?.prototypeId ?? `prototype-${index}`
    );

    return { matrix, axes, prototypeIds, excludedSparseAxes, unusedDefinedAxes };
  }

  /**
   * Filter out sparse axes that are used by too few prototypes.
   *
   * Sparse axes can inflate apparent dimensionality when z-scored because
   * the few non-zero values become extreme outliers (3+ standard deviations).
   * This filtering addresses the z-score inflation problem.
   *
   * @param {Array} prototypes - Prototype objects.
   * @param {string[]} axes - All available axes.
   * @param {number} minUsageRatio - Minimum fraction of prototypes that must use an axis.
   * @returns {{included: string[], excluded: string[]}} Filtered axes.
   */
  #filterSparseAxes(prototypes, axes, minUsageRatio) {
    // minUsageRatio of 0 disables filtering (backward compatibility)
    if (minUsageRatio <= 0) {
      return { included: axes, excluded: [] };
    }

    const minCount = Math.max(2, Math.ceil(prototypes.length * minUsageRatio));
    const included = [];
    const excluded = [];

    for (const axis of axes) {
      const usageCount = prototypes.filter((p) => {
        const value = p?.weights?.[axis];
        return typeof value === 'number' && Math.abs(value) > 0;
      }).length;

      if (usageCount >= minCount) {
        included.push(axis);
      } else {
        excluded.push(axis);
      }
    }

    return { included, excluded };
  }

  /**
   * Select axes with highest variance.
   *
   * @param {Array} prototypes - Prototype objects.
   * @param {string[]} axes - All available axes.
   * @param {number} limit - Maximum axes to select.
   * @returns {string[]} Selected axes sorted by variance.
   */
  #selectTopVarianceAxes(prototypes, axes, limit) {
    const varianceByAxis = axes.map((axis) => {
      const values = prototypes.map((prototype) => {
        const value = prototype?.weights?.[axis];
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
      });
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const variance =
        values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
        Math.max(1, values.length);
      return { axis, variance };
    });

    return varianceByAxis
      .sort((a, b) => b.variance - a.variance)
      .slice(0, limit)
      .map((entry) => entry.axis);
  }

  /**
   * Standardize matrix (z-score normalization).
   *
   * @param {number[][]} matrix - Input matrix.
   * @returns {{matrix: number[][], hasVariance: boolean}} Standardized matrix and variance flag.
   */
  /**
   * Normalize matrix using configured method.
   *
   * - 'center-only': Subtracts mean only, preserving original scale. Recommended for
   *   prototype weights which are already on a comparable scale [-1, 1].
   * - 'z-score': Subtracts mean and divides by standard deviation. Forces all axes
   *   to unit variance, which can cause rare axes to dominate.
   *
   * @param {number[][]} matrix - Input matrix.
   * @returns {{matrix: number[][], hasVariance: boolean}} Normalized matrix and variance flag.
   */
  #normalizeMatrix(matrix) {
    const rowCount = matrix.length;
    const columnCount = matrix[0]?.length ?? 0;
    const means = new Array(columnCount).fill(0);
    const stdDevs = new Array(columnCount).fill(0);
    const useZScore = this.#config.pcaNormalizationMethod === 'z-score';

    for (let col = 0; col < columnCount; col += 1) {
      let sum = 0;
      for (let row = 0; row < rowCount; row += 1) {
        sum += matrix[row][col];
      }
      means[col] = sum / rowCount;
    }

    if (useZScore) {
      for (let col = 0; col < columnCount; col += 1) {
        let sumSquares = 0;
        for (let row = 0; row < rowCount; row += 1) {
          const diff = matrix[row][col] - means[col];
          sumSquares += diff ** 2;
        }
        const variance = sumSquares / Math.max(1, rowCount - 1);
        stdDevs[col] = Math.sqrt(variance);
      }
    }

    const normalized = new Array(rowCount);
    let hasVariance = false;

    for (let row = 0; row < rowCount; row += 1) {
      normalized[row] = new Array(columnCount);
      for (let col = 0; col < columnCount; col += 1) {
        let value;
        if (useZScore) {
          const stdDev = stdDevs[col];
          value = stdDev > 0 ? (matrix[row][col] - means[col]) / stdDev : 0;
        } else {
          // center-only: just subtract mean
          value = matrix[row][col] - means[col];
        }
        normalized[row][col] = value;
        if (value !== 0) {
          hasVariance = true;
        }
      }
    }

    return { matrix: normalized, hasVariance };
  }

  /**
   * Compute covariance matrix.
   *
   * @param {number[][]} matrix - Standardized matrix.
   * @returns {number[][]|null} Covariance matrix or null if invalid.
   */
  #computeCovariance(matrix) {
    const rowCount = matrix.length;
    if (rowCount < 2) {
      return null;
    }
    const columnCount = matrix[0]?.length ?? 0;
    const covariance = Array.from({ length: columnCount }, () =>
      new Array(columnCount).fill(0)
    );
    const denom = rowCount - 1;

    for (let i = 0; i < columnCount; i += 1) {
      for (let j = i; j < columnCount; j += 1) {
        let sum = 0;
        for (let row = 0; row < rowCount; row += 1) {
          sum += matrix[row][i] * matrix[row][j];
        }
        const value = sum / denom;
        covariance[i][j] = value;
        covariance[j][i] = value;
      }
    }

    return covariance;
  }

  /**
   * Compute eigenvalue decomposition using Jacobi algorithm.
   *
   * @param {number[][]} matrix - Covariance matrix.
   * @returns {{values: number[], vectors: number[][]}|null} Eigenvalues and eigenvectors.
   */
  #computeEigenDecomposition(matrix) {
    const size = matrix.length;
    const a = matrix.map((row) => row.slice());
    const vectors = Array.from({ length: size }, (_, i) => {
      const row = new Array(size).fill(0);
      row[i] = 1;
      return row;
    });
    const maxIterations =
      this.#config.jacobiMaxIterationsOverride ?? 50 * size * size;
    const tolerance = this.#config.jacobiConvergenceTolerance ?? 1e-10;

    for (let iter = 0; iter < maxIterations; iter += 1) {
      let max = 0;
      let p = 0;
      let q = 1;
      for (let i = 0; i < size; i += 1) {
        for (let j = i + 1; j < size; j += 1) {
          const value = Math.abs(a[i][j]);
          if (value > max) {
            max = value;
            p = i;
            q = j;
          }
        }
      }

      if (max < tolerance) {
        break;
      }

      const diff = a[q][q] - a[p][p];
      const phi = 0.5 * Math.atan2(2 * a[p][q], diff);
      const c = Math.cos(phi);
      const s = Math.sin(phi);

      for (let k = 0; k < size; k += 1) {
        if (k !== p && k !== q) {
          const aik = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * aik - s * aqk;
          a[k][p] = a[p][k];
          a[q][k] = s * aik + c * aqk;
          a[k][q] = a[q][k];
        }
      }

      const app = a[p][p];
      const aqq = a[q][q];
      const apq = a[p][q];
      a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
      a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
      a[p][q] = 0;
      a[q][p] = 0;

      for (let k = 0; k < size; k += 1) {
        const vkp = vectors[k][p];
        const vkq = vectors[k][q];
        vectors[k][p] = c * vkp - s * vkq;
        vectors[k][q] = s * vkp + c * vkq;
      }
    }

    const eigenpairs = a.map((row, index) => ({
      value: row[index],
      vector: vectors.map((vrow) => vrow[index]),
    }));

    eigenpairs.sort((aPair, bPair) => bPair.value - aPair.value);

    return {
      values: eigenpairs.map((pair) => pair.value),
      vectors: eigenpairs.map((pair) => pair.vector),
    };
  }

  /**
   * Compute expected axis count based on active axes per prototype.
   *
   * @param {Array} prototypes - Prototype objects.
   * @param {string[]} axes - Available axes.
   * @returns {number} Expected axis count.
   */
  /**
   * Compute expected axis count based on configured method.
   *
   * - 'variance-80': Number of components needed to explain 80% of variance.
   * - 'variance-90': Number of components needed to explain 90% of variance.
   * - 'broken-stick': Number of components exceeding broken-stick threshold.
   * - 'median-active': Median active axes per prototype (original method).
   *
   * @param {object} params - Parameters object.
   * @param {Array} params.prototypes - Prototype objects.
   * @param {string[]} params.axes - Available axes.
   * @param {number[]} params.eigenvalues - Eigenvalues sorted in descending order.
   * @param {number} params.totalVariance - Sum of all eigenvalues.
   * @param {number} params.componentsFor80Pct - Components needed for 80% variance.
   * @param {number} params.componentsFor90Pct - Components needed for 90% variance.
   * @returns {number} Expected axis count.
   */
  #computeExpectedAxisCount({
    prototypes,
    axes,
    eigenvalues,
    totalVariance,
    componentsFor80Pct,
    componentsFor90Pct,
  }) {
    const method = this.#config.pcaExpectedDimensionMethod;

    switch (method) {
      case 'variance-80':
        return Math.max(1, Math.min(componentsFor80Pct, axes.length));

      case 'variance-90':
        return Math.max(1, Math.min(componentsFor90Pct, axes.length));

      case 'broken-stick': {
        // Use the broken-stick distribution to determine significant components
        const significantCount = countSignificantComponentsBrokenStick(
          eigenvalues,
          totalVariance
        );
        return Math.max(1, Math.min(significantCount, axes.length));
      }

      case 'median-active':
      default: {
        // Original method: median active axes per prototype
        const epsilon = this.#config.activeAxisEpsilon;
        const counts = prototypes.map((prototype) => {
          const weights = prototype?.weights ?? {};
          let active = 0;
          for (const axis of axes) {
            const value = weights[axis];
            if (typeof value === 'number' && Math.abs(value) >= epsilon) {
              active += 1;
            }
          }
          return active;
        });

        const sorted = counts.slice().sort((a, b) => a - b);
        const median = computeMedian(sorted);
        const axisCount = Math.max(1, Math.floor(median));

        return Math.min(axisCount, axes.length);
      }
    }
  }

  /**
   * Compute significant component metrics with both raw counts and difference.
   *
   * Uses either the broken-stick rule or Kaiser criterion based on configuration.
   *
   * @param {number[]} eigenvalues - All eigenvalues sorted in descending order.
   * @param {number} totalVariance - Sum of all eigenvalues.
   * @param {number} axisCount - Expected number of axes (K).
   * @returns {{significantComponentCount: number, significantBeyondExpected: number}} Metrics object.
   */
  #computeSignificantComponentMetrics(eigenvalues, totalVariance, axisCount) {
    const method = this.#config.pcaComponentSignificanceMethod;

    if (method === 'broken-stick') {
      // Broken-stick counts total significant components
      const significantComponentCount = countSignificantComponentsBrokenStick(
        eigenvalues,
        totalVariance
      );
      const significantBeyondExpected = Math.max(
        0,
        significantComponentCount - axisCount
      );
      return { significantComponentCount, significantBeyondExpected };
    }

    // Fallback: Kaiser criterion on residual eigenvalues
    // For Kaiser, count total significant first, then compute beyond expected
    const significantComponentCount = eigenvalues.filter(
      (value) => value >= this.#config.pcaKaiserThreshold
    ).length;
    const significantBeyondExpected = Math.max(
      0,
      significantComponentCount - axisCount
    );
    return { significantComponentCount, significantBeyondExpected };
  }

  /**
   * Compute extreme prototypes based on loadings on residual components.
   *
   * @param {object} params - Parameters.
   * @param {number} params.axisCount - Expected axis count.
   * @param {number[][]} params.eigenvectors - PCA eigenvectors.
   * @param {number[][]} params.matrix - Standardized matrix.
   * @param {string[]} params.prototypeIds - Prototype identifiers.
   * @returns {Array<{prototypeId: string, loading: number}>} Top 10 extreme prototypes.
   */
  #computeExtremePrototypes({ axisCount, eigenvectors, matrix, prototypeIds }) {
    if (axisCount >= eigenvectors.length) {
      return [];
    }

    const component = eigenvectors[axisCount];
    const scores = matrix.map((row, index) => {
      let projection = 0;
      for (let i = 0; i < row.length; i += 1) {
        projection += row[i] * component[i];
      }
      return { prototypeId: prototypeIds[index], loading: projection };
    });

    return scores
      .sort((a, b) => Math.abs(b.loading) - Math.abs(a.loading))
      .slice(0, 10);
  }

  /**
   * Compute reconstruction errors for prototypes.
   *
   * @param {object} params - Parameters.
   * @param {number[][]} params.matrix - Standardized matrix.
   * @param {number[][]} params.eigenvectors - PCA eigenvectors.
   * @param {number} params.axisCount - Components to use for reconstruction.
   * @param {string[]} params.prototypeIds - Prototype identifiers.
   * @param {Array<{id: string, weights: {[key: string]: number}}>} [params.prototypes] - Original prototypes for weight access. Defaults to empty array.
   * @param {string[]} [params.excludedSparseAxes] - Axes excluded due to sparse usage. Defaults to empty array.
   * @returns {Array<{prototypeId: string, error: number, excludedAxisReliance: number, reliesOnExcludedAxes: boolean}>} Top 5 worst-fitting prototypes with excluded axis reliance info.
   */
  #computeReconstructionErrors({
    matrix,
    eigenvectors,
    axisCount,
    prototypeIds,
    prototypes = [],
    excludedSparseAxes = [],
  }) {
    if (
      !matrix ||
      matrix.length === 0 ||
      !eigenvectors ||
      eigenvectors.length === 0 ||
      axisCount <= 0
    ) {
      return [];
    }

    const componentCount = Math.min(axisCount, eigenvectors.length);
    const featureCount = matrix[0].length;
    const errors = [];

    // Build a lookup map from prototypeId to prototype object for weight access
    const prototypeMap = new Map();
    for (const proto of prototypes) {
      if (proto && proto.id) {
        prototypeMap.set(proto.id, proto);
      }
    }

    for (let rowIdx = 0; rowIdx < matrix.length; rowIdx += 1) {
      const original = matrix[rowIdx];

      // Project onto principal components (reduce dimensionality)
      const projected = [];
      for (let pc = 0; pc < componentCount; pc += 1) {
        let projection = 0;
        for (let feat = 0; feat < featureCount; feat += 1) {
          projection += original[feat] * eigenvectors[pc][feat];
        }
        projected.push(projection);
      }

      // Reconstruct from reduced space
      const reconstructed = new Array(featureCount).fill(0);
      for (let pc = 0; pc < componentCount; pc += 1) {
        for (let feat = 0; feat < featureCount; feat += 1) {
          reconstructed[feat] += projected[pc] * eigenvectors[pc][feat];
        }
      }

      // Compute RMSE (root mean square error)
      let sumSquaredError = 0;
      for (let feat = 0; feat < featureCount; feat += 1) {
        const diff = original[feat] - reconstructed[feat];
        sumSquaredError += diff * diff;
      }
      const rmse = Math.sqrt(sumSquaredError / featureCount);

      // Compute excluded axis reliance for this prototype
      const prototypeId = prototypeIds[rowIdx];
      const prototype = prototypeMap.get(prototypeId);
      const prototypeWeights = prototype?.weights ?? {};

      let excludedAxisWeightSquared = 0;
      let totalWeightSquared = 0;

      for (const [axis, weight] of Object.entries(prototypeWeights)) {
        const weightSq = weight * weight;
        totalWeightSquared += weightSq;
        if (excludedSparseAxes.includes(axis)) {
          excludedAxisWeightSquared += weightSq;
        }
      }

      const excludedAxisReliance =
        totalWeightSquared > 0
          ? excludedAxisWeightSquared / totalWeightSquared
          : 0;
      // Flag as relying on excluded axes if >25% of weight is on excluded axes
      const reliesOnExcludedAxes = excludedAxisReliance > 0.25;

      errors.push({
        prototypeId,
        error: rmse,
        excludedAxisReliance,
        reliesOnExcludedAxes,
      });
    }

    // Sort by error descending (worst fitting first)
    return errors.sort((a, b) => b.error - a.error).slice(0, 5);
  }

  /**
   * Build the residual eigenvector mapped to axis names.
   *
   * @param {number[]} eigenvector - Eigenvector array from eigen decomposition.
   * @param {string[]} axes - Axis names in the same order as the eigenvector indices.
   * @returns {Record<string, number>} Eigenvector mapped to axis names.
   */
  #buildResidualEigenvector(eigenvector, axes) {
    const result = {};
    for (let i = 0; i < axes.length; i += 1) {
      result[axes[i]] = i < eigenvector.length ? eigenvector[i] : 0;
    }
    return result;
  }
}
