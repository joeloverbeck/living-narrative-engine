/**
 * @file PCA (Principal Component Analysis) Service for axis gap analysis.
 * @description Performs dimensionality reduction and variance analysis on prototype weights.
 */

import {
  computeMedian,
  countSignificantComponentsBrokenStick,
} from '../../utils/statisticalUtils.js';

/**
 * @typedef {object} PCAResult
 * @property {number} residualVarianceRatio - Ratio of unexplained variance.
 * @property {number} additionalSignificantComponents - Components beyond expected with significant variance.
 * @property {Array<{prototypeId: string, loading: number}>} topLoadingPrototypes - Top 10 extreme prototypes.
 * @property {string[]} dimensionsUsed - Axes included in analysis.
 * @property {number[]} cumulativeVariance - Cumulative variance explained per component.
 * @property {number[]} explainedVariance - Individual variance explained per component (ratio 0-1).
 * @property {number} componentsFor80Pct - Components needed for 80% variance.
 * @property {number} componentsFor90Pct - Components needed for 90% variance.
 * @property {Array<{prototypeId: string, error: number}>} reconstructionErrors - Top 5 worst-fitting prototypes.
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
   */
  constructor(config = {}) {
    this.#config = {
      pcaKaiserThreshold: config.pcaKaiserThreshold ?? 1.0,
      activeAxisEpsilon: config.activeAxisEpsilon ?? 0,
      pcaComponentSignificanceMethod:
        config.pcaComponentSignificanceMethod ?? 'broken-stick',
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

    const { matrix, axes, prototypeIds } = this.#buildWeightMatrix(prototypes);

    if (axes.length === 0 || matrix.length < 2) {
      return this.#createEmptyResult();
    }

    const hasNonZero = matrix.some((row) =>
      row.some((value) => Math.abs(value) > 0)
    );
    if (!hasNonZero) {
      return this.#createEmptyResult();
    }

    const standardized = this.#standardizeMatrix(matrix);
    if (!standardized.hasVariance) {
      return this.#createEmptyResult();
    }

    const covariance = this.#computeCovariance(standardized.matrix);
    if (!covariance || covariance.length === 0) {
      return this.#createEmptyResult();
    }

    const eigen = this.#computeEigenDecomposition(covariance);
    if (!eigen || eigen.values.length === 0) {
      return this.#createEmptyResult();
    }

    const totalVariance = eigen.values.reduce((sum, value) => sum + value, 0);
    if (totalVariance <= 0) {
      return this.#createEmptyResult();
    }

    const axisCount = this.#computeExpectedAxisCount(prototypes, axes);
    const residualValues = eigen.values.slice(axisCount);
    const residualVariance = residualValues.reduce((sum, value) => sum + value, 0);
    const residualVarianceRatio = Math.min(
      1,
      Math.max(0, residualVariance / totalVariance)
    );
    const additionalSignificantComponents = this.#computeAdditionalSignificantComponents(
      eigen.values,
      totalVariance,
      axisCount
    );
    const topLoadingPrototypes = this.#computeExtremePrototypes({
      axisCount,
      eigenvectors: eigen.vectors,
      matrix: standardized.matrix,
      prototypeIds,
    });

    // Compute cumulative variance from eigenvalues
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

    // Compute reconstruction errors for prototypes
    const reconstructionErrors = this.#computeReconstructionErrors({
      matrix: standardized.matrix,
      eigenvectors: eigen.vectors,
      axisCount,
      prototypeIds,
    });

    return {
      residualVarianceRatio,
      additionalSignificantComponents,
      topLoadingPrototypes,
      dimensionsUsed: axes,
      cumulativeVariance,
      explainedVariance,
      componentsFor80Pct,
      componentsFor90Pct,
      reconstructionErrors,
    };
  }

  /**
   * Create an empty PCA result.
   *
   * @returns {PCAResult} Empty result object.
   */
  #createEmptyResult() {
    return {
      residualVarianceRatio: 0,
      additionalSignificantComponents: 0,
      topLoadingPrototypes: [],
      dimensionsUsed: [],
      cumulativeVariance: [],
      explainedVariance: [],
      componentsFor80Pct: 0,
      componentsFor90Pct: 0,
      reconstructionErrors: [],
    };
  }

  /**
   * Build the weight matrix from prototypes.
   *
   * @param {Array} prototypes - Prototype objects.
   * @returns {{matrix: number[][], axes: string[], prototypeIds: string[]}} Matrix data.
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

    return { matrix, axes, prototypeIds };
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
  #standardizeMatrix(matrix) {
    const rowCount = matrix.length;
    const columnCount = matrix[0]?.length ?? 0;
    const means = new Array(columnCount).fill(0);
    const stdDevs = new Array(columnCount).fill(0);

    for (let col = 0; col < columnCount; col += 1) {
      let sum = 0;
      for (let row = 0; row < rowCount; row += 1) {
        sum += matrix[row][col];
      }
      means[col] = sum / rowCount;
    }

    for (let col = 0; col < columnCount; col += 1) {
      let sumSquares = 0;
      for (let row = 0; row < rowCount; row += 1) {
        const diff = matrix[row][col] - means[col];
        sumSquares += diff ** 2;
      }
      const variance = sumSquares / Math.max(1, rowCount - 1);
      stdDevs[col] = Math.sqrt(variance);
    }

    const standardized = new Array(rowCount);
    let hasVariance = false;

    for (let row = 0; row < rowCount; row += 1) {
      standardized[row] = new Array(columnCount);
      for (let col = 0; col < columnCount; col += 1) {
        const stdDev = stdDevs[col];
        const value =
          stdDev > 0 ? (matrix[row][col] - means[col]) / stdDev : 0;
        standardized[row][col] = value;
        if (value !== 0) {
          hasVariance = true;
        }
      }
    }

    return { matrix: standardized, hasVariance };
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
    const maxIterations = 50 * size * size;
    const tolerance = 1e-10;

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
  #computeExpectedAxisCount(prototypes, axes) {
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

  /**
   * Compute the number of additional significant components beyond expected axis count.
   *
   * Uses either the broken-stick rule or Kaiser criterion based on configuration.
   *
   * @param {number[]} eigenvalues - All eigenvalues sorted in descending order.
   * @param {number} totalVariance - Sum of all eigenvalues.
   * @param {number} axisCount - Expected number of axes (components to exclude from "additional").
   * @returns {number} Number of additional significant components.
   */
  #computeAdditionalSignificantComponents(eigenvalues, totalVariance, axisCount) {
    const method = this.#config.pcaComponentSignificanceMethod;

    if (method === 'broken-stick') {
      // Broken-stick counts total significant components, so subtract expected
      const totalSignificant = countSignificantComponentsBrokenStick(
        eigenvalues,
        totalVariance
      );
      return Math.max(0, totalSignificant - axisCount);
    }

    // Fallback: Kaiser criterion on residual eigenvalues
    const residualValues = eigenvalues.slice(axisCount);
    return residualValues.filter(
      (value) => value >= this.#config.pcaKaiserThreshold
    ).length;
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
   * @returns {Array<{prototypeId: string, error: number}>} Top 5 worst-fitting prototypes.
   */
  #computeReconstructionErrors({ matrix, eigenvectors, axisCount, prototypeIds }) {
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

      errors.push({
        prototypeId: prototypeIds[rowIdx],
        error: rmse,
      });
    }

    // Sort by error descending (worst fitting first)
    return errors
      .sort((a, b) => b.error - a.error)
      .slice(0, 5);
  }
}
