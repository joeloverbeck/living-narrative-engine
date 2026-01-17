# PROREGGATALI-003: Report Generator Integration

## Summary

Integrate `PrototypeGateAlignmentAnalyzer` into `MonteCarloReportGenerator` to produce the "Prototype Gate Alignment" section in the diagnostic report.

## Background

The analyzer (PROREGGATALI-001) detects contradictions. This ticket wires it into the report generator so contradictions appear in the `expression-diagnostics.html` output with a table and actionable recommendations.

## File List (Expected to Touch)

### Existing Files
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` — add dependency, call analyzer, generate section

## Out of Scope (MUST NOT Change)

- The analyzer implementation (`PrototypeGateAlignmentAnalyzer.js`)
- DI registration files
- Other section generators in `src/expressionDiagnostics/services/sectionGenerators/`
- UI rendering code in `src/domUI/`
- Tests (handled in PROREGGATALI-005)
- Any mod data under `data/mods/`
- Existing report sections (blocker, prototype fit, sensitivity, etc.)

## Implementation Details

### 1. Add Private Field

```javascript
#prototypeGateAlignmentAnalyzer;
```

### 2. Update Constructor

Add to constructor parameters (optional, default `null` for backward compatibility):

```javascript
constructor({
  logger,
  prototypeConstraintAnalyzer = null,
  prototypeFitRankingService = null,
  prototypeSynthesisService = null,
  prototypeGateAlignmentAnalyzer = null,  // NEW
  formattingService = null,
  // ... rest
}) {
  // ... existing validation
  this.#prototypeGateAlignmentAnalyzer = prototypeGateAlignmentAnalyzer;
  // ... rest
}
```

### 3. Add Section Generator Method

```javascript
/**
 * Generate Prototype Gate Alignment section
 * @param {PrototypeGateAlignmentResult} result
 * @returns {string} Markdown section content
 */
#generatePrototypeGateAlignmentSection(result) {
  if (!result || result.contradictions.length === 0) {
    return '';
  }

  const lines = [
    '## Prototype Gate Alignment',
    '',
    '| Emotion | Prototype Gate | Regime (axis) | Status | Distance |',
    '|---------|----------------|---------------|--------|----------|',
  ];

  for (const c of result.contradictions) {
    const regimeStr = `${c.axis} ∈ [${c.regime.min.toFixed(2)}, ${c.regime.max.toFixed(2)}]`;
    const statusBadge = c.severity === 'critical' ? '**CONTRADICTION**' : 'contradiction';
    lines.push(
      `| ${c.emotion} | \`${c.gate}\` | ${regimeStr} | ${statusBadge} | ${c.distance.toFixed(3)} |`
    );
  }

  lines.push('');

  // Add recommendations per critical contradiction
  const criticalContradictions = result.contradictions.filter(c => c.severity === 'critical');
  for (const c of criticalContradictions) {
    lines.push(
      `> **Unreachable emotion under regime**: \`emotions.${c.emotion}\` is always 0 in-regime ` +
      `because prototype gate \`${c.gate}\` contradicts regime \`${c.axis} >= ${c.regime.min.toFixed(2)}\`.`
    );
    lines.push(
      `> **Fix**: Relax regime on \`${c.axis}\`, loosen the prototype gate, ` +
      `or replace/create a prototype (e.g., focused_${c.emotion.split('_').pop()}).`
    );
    lines.push('');
  }

  return lines.join('\n');
}
```

### 4. Call Analyzer in `generate()` Method

In the `generate()` method, after extracting emotion conditions (reuse existing `#extractEmotionConditionsFromPrereqs` or similar):

```javascript
// Run prototype gate alignment analysis if analyzer is available
let prototypeGateAlignmentSection = '';
if (this.#prototypeGateAlignmentAnalyzer) {
  const emotionConditions = this.#extractEmotionConditionsFromPrereqs(prerequisites);
  const alignmentResult = this.#prototypeGateAlignmentAnalyzer.analyze({
    prerequisites,
    emotionConditions,
  });
  prototypeGateAlignmentSection = this.#generatePrototypeGateAlignmentSection(alignmentResult);
}
```

### 5. Include Section in Report Output

Add `prototypeGateAlignmentSection` to the report assembly, positioning it near the existing "Prototype Fit" or "Recommendations" sections. Insert after prototype-related sections and before recommendations.

## Acceptance Criteria

### Tests That Must Pass

1. ESLint: `npx eslint src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
2. TypeCheck: `npm run typecheck`
3. Existing unit tests: `npm run test:unit -- --runInBand --testPathPatterns="monteCarloReportGenerator" --coverage=false`

### Invariants That Must Remain True

1. **Backward compatibility**: When `prototypeGateAlignmentAnalyzer` is `null`, report generates without errors
2. **Section omission**: When no contradictions exist, no "Prototype Gate Alignment" section appears
3. **Section presence**: When contradictions exist, section contains table and recommendations
4. **Critical surfacing**: If any `severity=critical` contradiction exists, report includes "Unreachable emotion under regime" text
5. **Table format**: Markdown table has columns: Emotion, Prototype Gate, Regime (axis), Status, Distance
6. **Existing sections unaffected**: All existing report sections continue to generate correctly
7. **No exceptions**: Gracefully handles empty `prerequisites` or `emotionConditions`

## Dependencies

- **Requires**: PROREGGATALI-001 (analyzer implementation)
- **Requires**: PROREGGATALI-002 (DI registration, but integration can be tested with manual injection)

## Estimated Size

~50-80 lines of code (moderate change, localized to one file).
