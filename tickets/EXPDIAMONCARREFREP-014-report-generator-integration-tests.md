# EXPDIAMONCARREFREP-014: Add MonteCarloReportGenerator Prototype Fit Integration Tests

## Summary
Add integration tests for prototype fit analysis in report generation. The report identified that prototype fit sections, gap detection, and implied prototype analysis lack integration test coverage.

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| `tests/integration/expression-diagnostics/monteCarloReport.integration.test.js` | Modify | Add prototype fit test cases |

## Out of Scope

- **DO NOT** modify any production code
- **DO NOT** modify unit tests for report generator
- **DO NOT** add tests for UI rendering (modal)
- **DO NOT** modify other integration test files

## Acceptance Criteria

### Tests That Must Be Added

#### Prototype Fit Section
1. Test: Report includes prototype fit section when `PrototypeConstraintAnalyzer` available
2. Test: Prototype fit section lists matching prototypes with scores
3. Test: Prototype fit section handles no matching prototypes gracefully
4. Test: Prototype fit scores are in [0, 1] range

#### Gap Detection Section
1. Test: Report includes gap detection section
2. Test: Gap detection identifies axes with poor coverage
3. Test: Gap detection shows recommended adjustments
4. Test: Gap detection handles all-passing expressions

#### Implied Prototype Section
1. Test: Report includes implied prototype section when applicable
2. Test: Implied prototype suggests emotion prototypes based on prerequisites
3. Test: Implied prototype handles complex AND/OR prerequisites

#### Markdown Output Validation
1. Test: Report markdown is valid (parseable)
2. Test: Report contains all expected section headers
3. Test: Report table formatting is correct
4. Test: Report code blocks are properly closed

### Test Coverage Target
- Integration coverage for report generation >= 80%
- All report sections validated

### Invariants That Must Remain True
1. Tests follow project integration test patterns
2. Tests use real DI container where appropriate
3. Report markdown format is stable (no unexpected changes)
4. No production code modifications

## Implementation Notes

### Test Structure Template
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { buildTestContainer } from '../../../helpers/testContainerBuilder.js';
import { tokens as diagnosticTokens } from '../../../../src/dependencyInjection/tokens/tokens-diagnostics.js';

describe('MonteCarloReport Prototype Fit Integration', () => {
  let container;
  let reportGenerator;
  let monteCarloSimulator;
  let prototypeConstraintAnalyzer;

  beforeEach(async () => {
    container = await buildTestContainer({
      withMockDataRegistry: true,
      withTestExpressions: true,
      withEmotionPrototypes: true,
    });

    reportGenerator = container.resolve(diagnosticTokens.IMonteCarloReportGenerator);
    monteCarloSimulator = container.resolve(diagnosticTokens.IMonteCarloSimulator);
    prototypeConstraintAnalyzer = container.resolve(diagnosticTokens.IPrototypeConstraintAnalyzer);
  });

  afterEach(() => {
    container.dispose();
  });

  describe('prototype fit section', () => {
    it('includes prototype fit section when analyzer available', async () => {
      const expression = {
        id: 'test:joy_expression',
        prerequisites: { '>': [{ var: 'emotions.joy' }, 0.5] }
      };

      const simulationResult = monteCarloSimulator.run({
        expression,
        samples: 100,
        distribution: 'gaussian',
      });

      const reportMarkdown = reportGenerator.generate({
        simulationResult,
        blockers: simulationResult.blockers,
        prototypeAnalysis: prototypeConstraintAnalyzer.analyze(expression.prerequisites),
      });

      expect(reportMarkdown).toContain('## Prototype Fit');
      expect(reportMarkdown).toContain('joy');
    });

    it('lists matching prototypes with scores', async () => {
      const expression = {
        id: 'test:multi_emotion',
        prerequisites: {
          'and': [
            { '>': [{ var: 'emotions.joy' }, 0.5] },
            { '>': [{ var: 'emotions.excitement' }, 0.3] },
          ]
        }
      };

      const simulationResult = monteCarloSimulator.run({
        expression,
        samples: 100,
        distribution: 'gaussian',
      });

      const prototypeAnalysis = prototypeConstraintAnalyzer.analyze(expression.prerequisites);
      const reportMarkdown = reportGenerator.generate({
        simulationResult,
        blockers: simulationResult.blockers,
        prototypeAnalysis,
      });

      // Assert: Contains prototype scores
      expect(reportMarkdown).toMatch(/\|\s*Prototype\s*\|\s*Score\s*\|/);
      // Assert: Scores are formatted correctly (0.XX format)
      expect(reportMarkdown).toMatch(/\d\.\d{2}/);
    });

    it('prototype fit scores are in [0, 1] range', async () => {
      const expression = {
        id: 'test:score_bounds',
        prerequisites: { '>': [{ var: 'emotions.joy' }, 0.5] }
      };

      const prototypeAnalysis = prototypeConstraintAnalyzer.analyze(expression.prerequisites);

      // Assert all scores are bounded
      for (const [, score] of Object.entries(prototypeAnalysis.scores || {})) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('gap detection section', () => {
    it('includes gap detection section', async () => {
      const expression = {
        id: 'test:gap_detection',
        prerequisites: {
          'and': [
            { '>': [{ var: 'emotions.joy' }, 0.9] }, // Very high threshold = potential gap
            { '<': [{ var: 'emotions.fear' }, 0.1] }, // Very low threshold = potential gap
          ]
        }
      };

      const simulationResult = monteCarloSimulator.run({
        expression,
        samples: 100,
        distribution: 'gaussian',
      });

      const reportMarkdown = reportGenerator.generate({
        simulationResult,
        blockers: simulationResult.blockers,
      });

      expect(reportMarkdown).toContain('Gap');
    });

    it('gap detection identifies axes with poor coverage', async () => {
      // Expression with extreme thresholds that rarely trigger
      const expression = {
        id: 'test:poor_coverage',
        prerequisites: { '>': [{ var: 'emotions.joy' }, 0.99] }
      };

      const simulationResult = monteCarloSimulator.run({
        expression,
        samples: 100,
        distribution: 'gaussian',
      });

      const reportMarkdown = reportGenerator.generate({
        simulationResult,
        blockers: simulationResult.blockers,
      });

      // Low trigger rate indicates gap
      expect(simulationResult.triggerRate).toBeLessThan(0.1);
    });
  });

  describe('implied prototype section', () => {
    it('suggests emotion prototypes based on prerequisites', async () => {
      const expression = {
        id: 'test:implied_prototype',
        prerequisites: {
          'and': [
            { '>': [{ var: 'emotions.joy' }, 0.7] },
            { '>': [{ var: 'emotions.excitement' }, 0.6] },
            { '<': [{ var: 'emotions.fear' }, 0.2] },
          ]
        }
      };

      const simulationResult = monteCarloSimulator.run({
        expression,
        samples: 100,
        distribution: 'gaussian',
      });

      const prototypeAnalysis = prototypeConstraintAnalyzer.analyze(expression.prerequisites);
      const reportMarkdown = reportGenerator.generate({
        simulationResult,
        blockers: simulationResult.blockers,
        prototypeAnalysis,
      });

      // Assert: Report identifies implied emotional state
      expect(reportMarkdown).toContain('joy');
    });
  });

  describe('markdown output validation', () => {
    it('report markdown is structurally valid', async () => {
      const expression = {
        id: 'test:markdown_structure',
        prerequisites: { '>': [{ var: 'emotions.joy' }, 0.5] }
      };

      const simulationResult = monteCarloSimulator.run({
        expression,
        samples: 50,
        distribution: 'gaussian',
      });

      const reportMarkdown = reportGenerator.generate({
        simulationResult,
        blockers: simulationResult.blockers,
      });

      // Assert: Basic markdown structure
      expect(reportMarkdown).toContain('#'); // Has headers
      expect(reportMarkdown.split('```').length % 2).toBe(1); // Code blocks closed
      expect(reportMarkdown).not.toMatch(/\|\s*\|\s*\|$/m); // No empty table rows
    });

    it('report contains expected section headers', async () => {
      const expression = {
        id: 'test:section_headers',
        prerequisites: { '>': [{ var: 'emotions.joy' }, 0.5] }
      };

      const simulationResult = monteCarloSimulator.run({
        expression,
        samples: 50,
        distribution: 'gaussian',
      });

      const reportMarkdown = reportGenerator.generate({
        simulationResult,
        blockers: simulationResult.blockers,
        sensitivityData: { grid: [], thresholds: [] },
      });

      // Assert: Core sections present
      expect(reportMarkdown).toContain('# Monte Carlo');
      expect(reportMarkdown).toContain('## Summary');
    });
  });
});
```

## Verification Commands
```bash
npm run test:integration -- --testPathPattern="monteCarloReport.integration"
```

## Dependencies
- **Depends on**: EXPDIAMONCARREFREP-010 (ReportOrchestrator)
- **Blocks**: None
