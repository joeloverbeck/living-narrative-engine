# AXIGAPDETSPE-004: Implement PCA Analysis Method

## Description

Implement the `#runPCAAnalysis()` private method in AxisGapAnalyzer that detects latent dimensions via eigenvalue analysis. This method builds a weight matrix, standardizes columns, computes covariance eigenvalues, and identifies prototypes loading on unexplained variance. The public `analyze()` method remains a stub for AXIGAPDETSPE-008, so unit tests must call a test-only helper to reach the private method.

## Files to Modify

- `src/expressionDiagnostics/services/AxisGapAnalyzer.js`
  - Replace `#runPCAAnalysis()` stub with full implementation
  - Add any necessary private helper methods
  - Add a `__TEST_ONLY__runPCAAnalysis()` helper to expose the private method

- `tests/unit/expressionDiagnostics/services/axisGapAnalyzer.test.js`
  - Add `describe('PCA Analysis', ...)` test suite

## Out of Scope

- Hub detection implementation (AXIGAPDETSPE-005)
- Coverage gap detection implementation (AXIGAPDETSPE-006)
- Multi-axis conflict detection implementation (AXIGAPDETSPE-007)
- Report synthesis / public `analyze()` (AXIGAPDETSPE-008)
- Pipeline integration (AXIGAPDETSPE-009)
- UI integration (AXIGAPDETSPE-010)
- Importing external math libraries (use vanilla JS)

## Implementation Details

### Algorithm

1. **Build weight matrix** W[prototype, axis] from prototype weights
2. **Standardize columns** to zero mean, unit variance
3. **Compute covariance matrix** C = W^T * W / (n-1)
4. **Compute eigenpairs** using a symmetric Jacobi rotation (return eigenvalues + eigenvectors)
5. **Derive current axis count** as the median number of active axes per prototype
   - Use `config.activeAxisEpsilon` to treat |weight| >= epsilon as active
   - Clamp to [1, axisCount]
6. **Calculate residual variance ratio** = sum(eigenvalues[k:]) / sum(eigenvalues) where k = current axis count (0-based index)
7. **Flag** if residual > `pcaResidualVarianceThreshold` AND any eigenvalue[k:] >= `pcaKaiserThreshold`
8. **Identify top loading prototypes** on the first residual component (index k)

### Return Shape

```javascript
{
  residualVarianceRatio: number,        // 0.0 - 1.0
  additionalSignificantComponents: number, // 0 or more (eigenvalues >= threshold beyond k)
  topLoadingPrototypes: [
    { prototypeId: string, loading: number },
    // ... up to 10 prototypes
  ],
}
```

### Helper Methods Needed

```javascript
#buildWeightMatrix(prototypes) // Returns 2D array
#standardizeMatrix(matrix)     // Returns standardized 2D array
#computeCovariance(matrix)     // Returns covariance matrix
#computeEigenDecomposition(covMatrix) // Returns sorted eigenvalues + eigenvectors
#computeExpectedAxisCount(prototypes, axisNames) // Returns median active axis count
```

### Edge Cases

- Single prototype: Return empty result (no PCA possible)
- All-zero weights: Return empty result
- Fewer prototypes than axes: Use min(prototypes, axes) highest-variance axes for matrix

## Acceptance Criteria

### Tests That Must Pass

1. **PCA Analysis test suite** (use `__TEST_ONLY__runPCAAnalysis()` helper):
   - `should detect high residual variance when latent dimension exists`
     - Create prototypes clustering on synthetic latent dimension
     - Verify `residualVarianceRatio > 0.15`
     - Verify `additionalSignificantComponents >= 1` (use a test config Kaiser threshold that allows >=)

   - `should identify prototypes loading on missing dimension`
     - Use confusion-like prototypes (confusion, perplexity, doubt, curiosity)
     - Verify `topLoadingPrototypes` contains expected IDs

   - `should return low residual variance for well-fit data`
     - Use prototypes that fit current axes well
     - Verify `residualVarianceRatio < 0.15`

   - `should handle single prototype gracefully`
     - Pass array with one prototype
     - Verify returns `{ residualVarianceRatio: 0, additionalSignificantComponents: 0, topLoadingPrototypes: [] }`

   - `should handle all-zero weights gracefully`
     - Pass prototypes with all weights = 0
     - Verify returns empty result without throwing

   - `should handle fewer prototypes than axes`
     - Pass 3 prototypes with 10 axes
     - Verify computation completes without error

### Invariants That Must Remain True

1. Method remains private (`#runPCAAnalysis`)
2. No external math library dependencies added
3. Eigenvalue computation is numerically stable for typical inputs
4. `residualVarianceRatio` is always between 0.0 and 1.0
5. `topLoadingPrototypes` array length <= 10
6. `npm run typecheck` passes
7. `npx eslint src/expressionDiagnostics/services/AxisGapAnalyzer.js` passes

## Dependencies

- AXIGAPDETSPE-003 (service scaffold must exist)

## Estimated Diff Size

~200 lines of implementation + ~150 lines of tests = ~350 lines total

## Status

Completed

## Outcome

- Implemented PCA analysis with Jacobi eigen decomposition and median active-axis baseline; added variance-based axis selection when axes exceed prototypes.
- Added `__TEST_ONLY__runPCAAnalysis()` for unit tests instead of touching the `analyze()` stub.
- Added PCA unit tests covering residual variance, top loadings, and edge cases.
