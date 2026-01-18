# MONCARACTIMP-013: BlockerSectionGenerator Core Blocker Integration

## Summary

Extend the existing `BlockerSectionGenerator` to integrate with `MinimalBlockerSetCalculator` for displaying the "Core Blocker Summary" with 1-3 dominant blockers and their actionable insights.

## Priority

MEDIUM

## Effort

Small (~80 LOC)

## Dependencies

- MONCARACTIMP-001 (Configuration & Type Definitions)
- MONCARACTIMP-002 (MinimalBlockerSetCalculator)

## Rationale

The existing blocker section shows all blocking clauses. Integrating the minimal blocker set calculator surfaces the 1-3 most impactful blockers prominently, helping content creators focus on the highest-value changes.

## Files to Create

None - this extends an existing service.

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src/expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js` | MODIFY | Add core blocker summary integration |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | MODIFY | Add IBlockerSectionGenerator token (NEW) |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | MODIFY | Add new DI registration for BlockerSectionGenerator |

## Out of Scope

- New service creation
- MinimalBlockerSetCalculator implementation (MONCARACTIMP-002)
- Full section redesign
- Report generator changes (MONCARACTIMP-015)
- Integration tests (MONCARACTIMP-016)

## Implementation Details

### Key Discrepancies in Original Ticket (Corrected)

The original ticket contained several inaccurate assumptions about the codebase:

1. **Constructor Signature**: Actual constructor uses `{ formattingService, treeTraversal, dataExtractor, prototypeSectionGenerator }`, NOT `{ logger, blockerCalculator }`
2. **Main Method**: The actual method is `generateBlockerAnalysis()` with 10 parameters, NOT `generate(simulationResult)`
3. **DI Registration**: NO existing DI registration exists - must be created, not updated
4. **Logger**: BlockerSectionGenerator does NOT use a logger at all

### Corrected Changes to BlockerSectionGenerator

Add optional `blockerCalculator` to constructor for backward compatibility:

```javascript
// Modify constructor to optionally accept MinimalBlockerSetCalculator
constructor({
  formattingService,
  treeTraversal = null,
  dataExtractor = null,
  prototypeSectionGenerator = null,
  blockerCalculator = null,  // NEW - optional for backward compatibility
} = {}) {
  if (!formattingService) {
    throw new Error('BlockerSectionGenerator requires formattingService');
  }

  this.#formattingService = formattingService;
  this.#treeTraversal = treeTraversal ?? new BlockerTreeTraversal();
  this.#dataExtractor = dataExtractor ?? new ReportDataExtractor();
  this.#prototypeSectionGenerator = prototypeSectionGenerator ?? null;
  this.#blockerCalculator = blockerCalculator;  // NEW
}

// Modify existing generateBlockerAnalysis() return to include core blocker summary
generateBlockerAnalysis(
  blockers,
  sampleCount,
  axisConstraints,
  storedContexts = null,
  populationSummary = null,
  storedPopulations = null,
  hasOrMoodConstraints = false,
  moodConstraints = [],
  gateCompatibility = null,
  simulationResult = null
) {
  // ... existing blocker analysis code ...

  // Add core blocker summary section if calculator is available
  const coreBlockerSummary = this.#blockerCalculator
    ? this.#generateCoreBlockerSection(simulationResult)
    : '';

  return `## Blocker Analysis
Signal: final (gate-clamped intensity).

${scopeHeader}
${probabilityFunnel}

${coreBlockerSummary}

${blockerSections.join('\n')}
${note}`;
}

/**
 * Generate core blocker section using MinimalBlockerSetCalculator
 * @param {Object} simulationResult - Monte Carlo simulation result
 * @returns {string} Formatted core blocker section
 */
#generateCoreBlockerSection(simulationResult) {
  if (!this.#blockerCalculator || !simulationResult) {
    return '';
  }

  const clauses = simulationResult.clauseTracking ?? [];
  const result = this.#blockerCalculator.calculate(clauses, simulationResult);

  return this.#formatCoreBlockerSummary(result);
}

/**
 * Format core blocker summary for display
 * @param {Object} blockerResult - MinimalBlockerSetCalculator result
 * @returns {string}
 */
#formatCoreBlockerSummary(blockerResult) {
  const { coreBlockers, nonCoreConstraints } = blockerResult;

  if (coreBlockers.length === 0) {
    return '';
  }

  const lines = [];
  lines.push(`### Core Blockers (${coreBlockers.length})`);
  lines.push('');
  lines.push('*These clauses have the highest impact on trigger rate:*');
  lines.push('');

  for (let i = 0; i < coreBlockers.length; i++) {
    const blocker = coreBlockers[i];
    const rank = i + 1;

    lines.push(`**${rank}. ${blocker.clauseDescription || blocker.clauseId}**`);
    lines.push(`- Last-Mile Rate: ${this.#formattingService.formatPercentage(blocker.lastMileRate)}`);
    lines.push(`- Impact Score: ${this.#formattingService.formatPercentage(blocker.impactScore)}`);
    lines.push(`- Composite Score: ${this.#formattingService.formatNumber(blocker.compositeScore)}`);

    const insight = this.#generateBlockerInsight(blocker);
    if (insight) {
      lines.push(`- 💡 ${insight}`);
    }
    lines.push('');
  }

  if (nonCoreConstraints.length > 0) {
    lines.push(`*${nonCoreConstraints.length} non-core constraints with >95% pass rate*`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate actionable insight for a core blocker
 * @param {Object} blocker
 * @returns {string|null}
 */
#generateBlockerInsight(blocker) {
  if (blocker.lastMileRate > 0.8) {
    return 'Final gatekeeper - nearly always the last barrier to pass';
  }

  if (blocker.impactScore > 0.3) {
    return 'High impact - addressing this could significantly improve trigger rate';
  }

  if (blocker.impactScore > 0.1) {
    return 'Meaningful contribution to blocking';
  }

  return null;
}
```

### NEW DI Token (tokens-diagnostics.js)

```javascript
// Add new token (NOT updating existing - none exists)
IBlockerSectionGenerator: 'IBlockerSectionGenerator',
```

### NEW DI Registration (expressionDiagnosticsRegistrations.js)

```javascript
// Add import at top
import BlockerSectionGenerator from '../../expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js';
import ReportFormattingService from '../../expressionDiagnostics/services/ReportFormattingService.js';

// Add new registration (NOT updating existing - none exists)
registrar.singletonFactory(
  diagnosticsTokens.IBlockerSectionGenerator,
  (c) =>
    new BlockerSectionGenerator({
      formattingService: new ReportFormattingService(),
      blockerCalculator: c.resolve(diagnosticsTokens.IMinimalBlockerSetCalculator),
    })
);
safeDebug(`Registered ${diagnosticsTokens.IBlockerSectionGenerator}`);
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Type checking
npm run typecheck

# Linting
npx eslint src/expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js

# Existing tests still pass (backward compatibility)
npm run test:unit -- --testPathPattern="blockerSectionGenerator"
```

### Invariants That Must Remain True

1. Existing `generateBlockerAnalysis()` output structure must be preserved (backward compatible)
2. Core blocker summary is additive, not replacing existing data
3. Integration gracefully handles missing calculator (null check)
4. **Existing unit tests continue to pass WITHOUT modification** (backward compatibility)
5. `blockerCalculator` constructor parameter is OPTIONAL

## Verification Commands

```bash
# Verify changes compile
npm run typecheck

# Lint modified files
npx eslint src/expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js \
  src/dependencyInjection/tokens/tokens-diagnostics.js \
  src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js

# Run existing tests
npm run test:unit -- --testPathPattern="blockerSectionGenerator"

# Verify new methods exist
grep -n "formatCoreBlockerSummary\|generateBlockerInsight" \
  src/expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js
```

## Estimated Diff Size

- `BlockerSectionGenerator.js`: ~80 lines added
- `tokens-diagnostics.js`: ~1 line added
- `expressionDiagnosticsRegistrations.js`: ~12 lines added

**Total**: ~95 lines

## Definition of Done

- [ ] Constructor modified to accept optional `blockerCalculator`
- [ ] `#blockerCalculator` private field added
- [ ] `#generateCoreBlockerSection()` method added
- [ ] `#formatCoreBlockerSummary()` method added
- [ ] `#generateBlockerInsight()` method added
- [ ] `generateBlockerAnalysis()` modified to include core blocker summary
- [ ] `IBlockerSectionGenerator` token added to tokens-diagnostics.js
- [ ] DI registration created in expressionDiagnosticsRegistrations.js
- [ ] `npm run typecheck` passes
- [ ] ESLint passes
- [ ] **Existing tests still pass WITHOUT modification** (backward compatibility)
- [ ] New tests added for core blocker integration
