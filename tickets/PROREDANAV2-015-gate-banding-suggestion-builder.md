# PROREDANAV2-015: Create GateBandingSuggestionBuilder Service (D2)

## Description

Create a service that generates gate banding suggestions for nested siblings and needs separation cases. This helps users understand how to differentiate overlapping prototypes.

## Files to Touch

### Create
- `src/expressionDiagnostics/services/prototypeOverlap/GateBandingSuggestionBuilder.js`
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/gateBandingSuggestionBuilder.test.js`

### Modify
- `src/dependencyInjection/registrations/prototypeOverlapRegistrations.js` (add registration)

## Out of Scope

- Integrating suggestions into orchestrator output (PROREDANAV2-017)
- UI rendering of suggestions
- Automatically applying suggestions
- Expression creation

## Changes Required

### 1. Create GateBandingSuggestionBuilder Class

```javascript
/**
 * Generates gate banding suggestions for nested/separation cases.
 * Helps differentiate overlapping prototypes by suggesting gate adjustments.
 */
class GateBandingSuggestionBuilder {
  #config;
  #logger;

  constructor({ config, logger }) {
    this.#config = config;
    this.#logger = logger;
  }

  buildSuggestions(gateImplicationEvidence, classification) {
    // Returns array of suggestions
  }
}
```

### 2. Implement Suggestion Generation Logic

```javascript
buildSuggestions(gateImplicationEvidence, classification) {
  const suggestions = [];
  const bandMargin = this.#config.bandMargin || 0.05;

  if (!gateImplicationEvidence?.evidence) {
    return suggestions;
  }

  // Only generate suggestions for nested_siblings or needs_separation
  if (!['nested_siblings', 'needs_separation'].includes(classification)) {
    return suggestions;
  }

  for (const axisEvidence of gateImplicationEvidence.evidence) {
    const suggestion = this.#analyzeAxisForBanding(axisEvidence, bandMargin);
    if (suggestion) {
      suggestions.push(suggestion);
    }
  }

  // Add expression-level suppression suggestion for nested siblings
  if (classification === 'nested_siblings') {
    suggestions.push({
      type: 'expression_suppression',
      message: 'When higher-tier prototype is active, cap lower-tier intensity to 0',
      suggestedAction: 'Add expression-level mutual exclusion rule'
    });
  }

  return suggestions;
}
```

### 3. Implement Axis Analysis

```javascript
#analyzeAxisForBanding(axisEvidence, bandMargin) {
  const { axis, A, B, relation } = axisEvidence;

  // Only suggest banding when one is clearly narrower
  if (relation !== 'narrower' && relation !== 'wider') {
    return null;
  }

  const narrower = relation === 'narrower' ? A : B;
  const broader = relation === 'narrower' ? B : A;
  const narrowerLabel = relation === 'narrower' ? 'A' : 'B';
  const broaderLabel = relation === 'narrower' ? 'B' : 'A';

  const suggestion = {
    type: 'gate_band',
    axis,
    affectedPrototype: broaderLabel,
    reason: `${narrowerLabel} has tighter ${axis} constraints`
  };

  // Suggest opposite bound for broader prototype
  if (narrower.upper < Infinity && narrower.upper < broader.upper) {
    // Narrower has upper bound that broader doesn't enforce as tightly
    suggestion.suggestedGate = `${axis} >= ${(narrower.upper + bandMargin).toFixed(2)}`;
    suggestion.message = `Add gate "${suggestion.suggestedGate}" to ${broaderLabel} to exclude overlap with ${narrowerLabel}`;
  } else if (narrower.lower > -Infinity && narrower.lower > broader.lower) {
    // Narrower has lower bound that broader doesn't enforce as tightly
    suggestion.suggestedGate = `${axis} <= ${(narrower.lower - bandMargin).toFixed(2)}`;
    suggestion.message = `Add gate "${suggestion.suggestedGate}" to ${broaderLabel} to exclude overlap with ${narrowerLabel}`;
  } else {
    return null; // No clear banding suggestion
  }

  return suggestion;
}
```

### 4. Add DI Registration

In `prototypeOverlapRegistrations.js`:
```javascript
import GateBandingSuggestionBuilder from '../../expressionDiagnostics/services/prototypeOverlap/GateBandingSuggestionBuilder.js';

container.registerFactory(
  diagnosticsTokens.IGateBandingSuggestionBuilder,
  (c) => new GateBandingSuggestionBuilder({
    config: c.resolve(diagnosticsTokens.IPrototypeOverlapConfig),
    logger: c.resolve(coreTokens.ILogger)
  })
);
```

## Acceptance Criteria

### Tests That Must Pass

1. **Upper bound suggestion**:
   - Tighter has `valence <= -0.10`
   - Broader has `valence <= 0.50`
   - → Suggest broader add `valence >= -0.05`

2. **Lower bound suggestion**:
   - Tighter has `arousal >= 0.55`
   - Broader has `arousal >= 0.20`
   - → Suggest broader add `arousal <= 0.50`

3. **Threat axis example from spec**:
   - Tighter has `threat <= 0.20`
   - → Suggest broader add `threat >= 0.25`

4. **Uses config.bandMargin**:
   - With bandMargin=0.10, suggestions offset by 0.10

5. **Expression suppression for nested_siblings**:
   - classification='nested_siblings'
   - → Includes expression_suppression suggestion

6. **No suggestions for non-applicable classifications**:
   - classification='merge_recommended' → empty suggestions
   - classification='keep_distinct' → empty suggestions

7. **Handles missing evidence gracefully**:
   - null evidence → empty suggestions
   - empty evidence array → empty suggestions

8. **Multiple axis suggestions**:
   - Evidence with 3 axes, 2 have clear banding
   - → Returns 2 gate_band suggestions + 1 expression_suppression

9. **DI registration works**:
   - IGateBandingSuggestionBuilder resolvable from container

### Invariants That Must Remain True

- Suggestions are always an array (never null/undefined)
- bandMargin applied consistently
- Suggested gates use standard format: `axis op value`
- Service is stateless
- Does not modify input evidence

## Estimated Size

~150 lines of code + ~200 lines of tests

## Dependencies

- PROREDANAV2-001 (config with bandMargin)
- PROREDANAV2-008 (GateImplicationEvaluator produces input format)
- PROREDANAV2-013 (DI tokens registered)

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- --testPathPattern=gateBandingSuggestionBuilder

# Run DI registration tests
npm run test:unit -- --testPathPattern=prototypeOverlapRegistrations

# Lint
npx eslint src/expressionDiagnostics/services/prototypeOverlap/GateBandingSuggestionBuilder.js
```
