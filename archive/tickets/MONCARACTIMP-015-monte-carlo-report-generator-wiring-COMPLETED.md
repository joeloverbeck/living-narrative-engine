# MONCARACTIMP-015: MonteCarloReportGenerator Wiring

## Summary

Wire the new `ActionabilitySectionGenerator` and updated `BlockerSectionGenerator` into the `MonteCarloReportGenerator` to include actionability analysis in generated reports.

## Priority

MEDIUM

## Effort

Small (~120 LOC)

## Dependencies

- MONCARACTIMP-013 (BlockerSectionGenerator Integration)
- MONCARACTIMP-014 (ActionabilitySectionGenerator)

## Rationale

The new actionability services need to be connected to the main report generator to appear in Monte Carlo diagnostic reports. This is the final wiring step that makes all previous work visible to users.

## Files to Create

None - this modifies existing files.

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | MODIFY | Add actionability section to report generation |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | MODIFY | Update MonteCarloReportGenerator registration |

## Out of Scope

- New service creation
- Section generator implementations (done in previous tickets)
- Report template/format changes beyond adding sections
- Integration tests (MONCARACTIMP-016)
- Performance tests (MONCARACTIMP-017)

## Implementation Details

### Changes to MonteCarloReportGenerator

#### Constructor Update

Add `actionabilitySectionGenerator` to dependencies:

```javascript
constructor({
  logger,
  summarySectionGenerator,
  blockerSectionGenerator,
  sensitivitySectionGenerator,
  distributionSectionGenerator,
  actionabilitySectionGenerator, // NEW
  // ... other dependencies
}) {
  validateDependency(logger, 'ILogger', logger, {
    requiredMethods: ['info', 'warn', 'error', 'debug'],
  });
  validateDependency(actionabilitySectionGenerator, 'IActionabilitySectionGenerator', logger, {
    requiredMethods: ['generate'],
  });

  this.#logger = logger;
  this.#summarySectionGenerator = summarySectionGenerator;
  this.#blockerSectionGenerator = blockerSectionGenerator;
  this.#sensitivitySectionGenerator = sensitivitySectionGenerator;
  this.#distributionSectionGenerator = distributionSectionGenerator;
  this.#actionabilitySectionGenerator = actionabilitySectionGenerator; // NEW
  // ... assign other dependencies
}
```

#### Generate Method Update

Add actionability section generation:

```javascript
generate(simulationResult, options = {}) {
  const report = {
    metadata: this.#generateMetadata(simulationResult, options),
    sections: [],
  };

  try {
    // Existing sections
    const summary = this.#summarySectionGenerator.generate(simulationResult);
    report.sections.push({ type: 'summary', data: summary });

    const blockers = this.#blockerSectionGenerator.generate(simulationResult);
    report.sections.push({ type: 'blockers', data: blockers });

    const sensitivity = this.#sensitivitySectionGenerator.generate(simulationResult);
    report.sections.push({ type: 'sensitivity', data: sensitivity });

    const distribution = this.#distributionSectionGenerator.generate(simulationResult);
    report.sections.push({ type: 'distribution', data: distribution });

    // NEW: Actionability section
    if (this.#shouldGenerateActionability(simulationResult, options)) {
      const actionability = this.#actionabilitySectionGenerator.generate(simulationResult);
      report.sections.push({ type: 'actionability', data: actionability });

      this.#logger.debug(
        `MonteCarloReportGenerator: Added actionability section ` +
        `(${actionability.editSet?.alternativeEdits?.length ?? 0} edit proposals)`
      );
    }

    // Generate formatted output
    report.formatted = this.#formatReport(report);

  } catch (err) {
    this.#logger.error('MonteCarloReportGenerator: Generation error', err);
    report.error = err.message;
  }

  return report;
}

/**
 * Determine if actionability section should be generated
 * @param {Object} simulationResult
 * @param {Object} options
 * @returns {boolean}
 */
#shouldGenerateActionability(simulationResult, options) {
  // Always generate if explicitly requested
  if (options.includeActionability === true) {
    return true;
  }

  // Skip if explicitly disabled
  if (options.includeActionability === false) {
    return false;
  }

  // Default: generate for low trigger rate expressions
  const triggerRate = simulationResult.triggerRate ?? 0;
  return triggerRate < 0.1; // Include for expressions with <10% trigger rate
}
```

#### Format Report Update

Add actionability section to formatted output:

```javascript
#formatReport(report) {
  const lines = [];

  for (const section of report.sections) {
    switch (section.type) {
      case 'summary':
        lines.push(...(section.data.formatted || []));
        break;
      case 'blockers':
        lines.push(...(section.data.formatted || []));
        // Include core blocker summary if available
        if (section.data.coreBlockerSummary) {
          lines.push(...section.data.coreBlockerSummary);
        }
        break;
      case 'sensitivity':
        lines.push(...(section.data.formatted || []));
        // Include threshold suggestions if available
        if (section.data.formattedSuggestions) {
          lines.push(...section.data.formattedSuggestions);
        }
        break;
      case 'distribution':
        lines.push(...(section.data.formatted || []));
        break;
      case 'actionability': // NEW
        lines.push(...(section.data.formatted || []));
        break;
      default:
        this.#logger.warn(`Unknown section type: ${section.type}`);
    }
  }

  return lines.join('\n');
}
```

### DI Registration Update

Modify `expressionDiagnosticsRegistrations.js`:

```javascript
// Update MonteCarloReportGenerator registration
registrar.singletonFactory(
  diagnosticsTokens.IMonteCarloReportGenerator,
  (c) =>
    new MonteCarloReportGenerator({
      logger: c.resolve(tokens.ILogger),
      summarySectionGenerator: c.resolve(diagnosticsTokens.ISummarySectionGenerator),
      blockerSectionGenerator: c.resolve(diagnosticsTokens.IBlockerSectionGenerator),
      sensitivitySectionGenerator: c.resolve(diagnosticsTokens.ISensitivitySectionGenerator),
      distributionSectionGenerator: c.resolve(diagnosticsTokens.IDistributionSectionGenerator),
      actionabilitySectionGenerator: c.resolve(diagnosticsTokens.IActionabilitySectionGenerator), // NEW
    })
);
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Type checking
npm run typecheck

# Linting
npx eslint src/expressionDiagnostics/services/MonteCarloReportGenerator.js
npx eslint src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js

# Existing tests still pass
npm run test:unit -- --testPathPattern="MonteCarloReportGenerator"
```

### Invariants That Must Remain True

1. Existing report sections must continue to work unchanged
2. Actionability section is optional (graceful if service missing)
3. Report structure remains backward compatible
4. Existing unit tests continue to pass (may need mock updates)
5. Report generation does not fail if actionability analysis fails

## Verification Commands

```bash
# Verify changes compile
npm run typecheck

# Lint modified files
npx eslint src/expressionDiagnostics/services/MonteCarloReportGenerator.js
npx eslint src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js

# Run existing tests
npm run test:unit -- --testPathPattern="MonteCarloReportGenerator"

# Verify actionability section in generator
grep -n "actionabilitySectionGenerator\|actionability" src/expressionDiagnostics/services/MonteCarloReportGenerator.js
```

## Estimated Diff Size

- `MonteCarloReportGenerator.js`: ~80 lines added/modified
- `expressionDiagnosticsRegistrations.js`: ~3 lines modified

**Total**: ~85 lines (plus additional lines for existing tests if mock updates needed)

## Definition of Done

- [ ] Constructor updated to accept `actionabilitySectionGenerator`
- [ ] `generate()` includes actionability section
- [ ] `#shouldGenerateActionability()` method added
- [ ] `#formatReport()` handles actionability section
- [ ] DI registration updated
- [ ] `npm run typecheck` passes
- [ ] ESLint passes
- [ ] Existing tests still pass (with mock updates)
- [ ] Actionability section appears in reports for low-trigger expressions
