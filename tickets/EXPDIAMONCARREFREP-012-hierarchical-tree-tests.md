# EXPDIAMONCARREFREP-012: Add MonteCarloSimulator Hierarchical Tree Tests

## Summary
Add missing tests for hierarchical clause tree building and evaluation methods in `MonteCarloSimulator`. The report identified that tree traversal and clause tracking for compound AND/OR trees are not explicitly tested.

## Files to Create

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.hierarchical.test.js` | Create | Tests for hierarchical tree methods |

## Out of Scope

- **DO NOT** modify any production code
- **DO NOT** modify existing `monteCarloSimulator.test.js`
- **DO NOT** modify `HierarchicalClauseNode.test.js`
- **DO NOT** add integration tests

## Acceptance Criteria

### Tests That Must Be Added

#### #buildHierarchicalTree()
1. Test: Builds single leaf node from simple condition
2. Test: Builds AND node with multiple children
3. Test: Builds OR node with multiple children
4. Test: Builds nested AND within OR structure
5. Test: Builds nested OR within AND structure
6. Test: Handles deeply nested (3+ levels) structures
7. Test: Returns null/empty for invalid logic

#### #evaluateHierarchicalNode()
1. Test: Evaluates leaf node correctly (pass case)
2. Test: Evaluates leaf node correctly (fail case)
3. Test: AND node passes when all children pass
4. Test: AND node fails when any child fails
5. Test: OR node passes when any child passes
6. Test: OR node fails when all children fail
7. Test: Nested evaluation propagates correctly

#### #extractCeilingData()
1. Test: Extracts ceiling data from single condition
2. Test: Extracts ceiling data from AND compound
3. Test: Extracts ceiling data from OR compound
4. Test: Handles nested structures correctly
5. Test: Returns empty array for no ceiling conditions

#### #describeLeafCondition()
1. Test: Describes emotion condition (e.g., "joy > 0.5")
2. Test: Describes sexual state condition (e.g., "arousal >= 0.3")
3. Test: Describes mood axis condition (e.g., "valence < 0")
4. Test: Describes compound condition with AND
5. Test: Handles unknown variable paths gracefully

#### #describeOperand()
1. Test: Describes { var: "emotions.joy" } as "emotions.joy"
2. Test: Describes constant 0.5 as "0.5"
3. Test: Describes nested accessor { var: "context.deep.path" }

#### Clause Tracking
1. Test: Leaf counts are accurate for simple tree
2. Test: Leaf counts are accurate for compound tree
3. Test: Last-mile statistics calculated correctly
4. Test: Failure rates aggregated correctly per node

### Test Coverage Target
- Hierarchical tree methods >= 85% coverage
- All tree node types validated

### Invariants That Must Remain True
1. Tests follow existing patterns in `monteCarloSimulator.test.js`
2. Tests use mock dependencies consistently
3. No production code modifications

## Implementation Notes

### Test Structure Template
```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';

describe('MonteCarloSimulator - Hierarchical Tree', () => {
  let simulator;
  let mockLogger;
  let mockDataRegistry;
  let mockJsonLogicEvaluationService;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn().mockReturnValue({ entries: {} }),
    };

    mockJsonLogicEvaluationService = {
      evaluate: jest.fn().mockReturnValue(true),
    };

    simulator = new MonteCarloSimulator({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
      jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      // ... other mocks
    });
  });

  describe('#buildHierarchicalTree()', () => {
    it('builds single leaf node from simple condition', () => {
      const logic = { '>': [{ var: 'emotions.joy' }, 0.5] };

      const tree = simulator.buildHierarchicalTree(logic);

      expect(tree.type).toBe('leaf');
      expect(tree.clauseDescription).toContain('joy');
    });

    it('builds AND node with multiple children', () => {
      const logic = {
        'and': [
          { '>': [{ var: 'emotions.joy' }, 0.5] },
          { '<': [{ var: 'emotions.fear' }, 0.3] },
        ]
      };

      const tree = simulator.buildHierarchicalTree(logic);

      expect(tree.type).toBe('and');
      expect(tree.children).toHaveLength(2);
      expect(tree.children[0].type).toBe('leaf');
      expect(tree.children[1].type).toBe('leaf');
    });

    it('builds OR node with multiple children', () => {
      const logic = {
        'or': [
          { '>': [{ var: 'emotions.joy' }, 0.5] },
          { '>': [{ var: 'emotions.excitement' }, 0.5] },
        ]
      };

      const tree = simulator.buildHierarchicalTree(logic);

      expect(tree.type).toBe('or');
      expect(tree.children).toHaveLength(2);
    });

    it('builds nested AND within OR structure', () => {
      const logic = {
        'or': [
          {
            'and': [
              { '>': [{ var: 'emotions.joy' }, 0.5] },
              { '<': [{ var: 'emotions.fear' }, 0.3] },
            ]
          },
          { '>': [{ var: 'emotions.excitement' }, 0.7] },
        ]
      };

      const tree = simulator.buildHierarchicalTree(logic);

      expect(tree.type).toBe('or');
      expect(tree.children[0].type).toBe('and');
      expect(tree.children[0].children).toHaveLength(2);
      expect(tree.children[1].type).toBe('leaf');
    });

    it('handles deeply nested structures (3+ levels)', () => {
      const logic = {
        'and': [
          {
            'or': [
              {
                'and': [
                  { '>': [{ var: 'a' }, 0.1] },
                  { '<': [{ var: 'b' }, 0.9] },
                ]
              },
              { '==': [{ var: 'c' }, 0.5] },
            ]
          },
          { '>=': [{ var: 'd' }, 0] },
        ]
      };

      const tree = simulator.buildHierarchicalTree(logic);

      expect(tree.type).toBe('and');
      expect(tree.children[0].type).toBe('or');
      expect(tree.children[0].children[0].type).toBe('and');
    });
  });

  describe('#evaluateHierarchicalNode()', () => {
    it('AND node passes when all children pass', () => {
      const context = { emotions: { joy: 0.8, fear: 0.1 } };
      mockJsonLogicEvaluationService.evaluate
        .mockReturnValueOnce(true)  // joy > 0.5
        .mockReturnValueOnce(true); // fear < 0.3

      const logic = {
        'and': [
          { '>': [{ var: 'emotions.joy' }, 0.5] },
          { '<': [{ var: 'emotions.fear' }, 0.3] },
        ]
      };
      const tree = simulator.buildHierarchicalTree(logic);
      const result = simulator.evaluateHierarchicalNode(tree, context);

      expect(result.passed).toBe(true);
    });

    it('AND node fails when any child fails', () => {
      const context = { emotions: { joy: 0.8, fear: 0.5 } };
      mockJsonLogicEvaluationService.evaluate
        .mockReturnValueOnce(true)   // joy > 0.5
        .mockReturnValueOnce(false); // fear < 0.3

      const logic = {
        'and': [
          { '>': [{ var: 'emotions.joy' }, 0.5] },
          { '<': [{ var: 'emotions.fear' }, 0.3] },
        ]
      };
      const tree = simulator.buildHierarchicalTree(logic);
      const result = simulator.evaluateHierarchicalNode(tree, context);

      expect(result.passed).toBe(false);
    });

    it('OR node passes when any child passes', () => {
      const context = { emotions: { joy: 0.3, excitement: 0.8 } };
      mockJsonLogicEvaluationService.evaluate
        .mockReturnValueOnce(false)  // joy > 0.5
        .mockReturnValueOnce(true);  // excitement > 0.5

      const logic = {
        'or': [
          { '>': [{ var: 'emotions.joy' }, 0.5] },
          { '>': [{ var: 'emotions.excitement' }, 0.5] },
        ]
      };
      const tree = simulator.buildHierarchicalTree(logic);
      const result = simulator.evaluateHierarchicalNode(tree, context);

      expect(result.passed).toBe(true);
    });
  });

  describe('#describeLeafCondition()', () => {
    it('describes emotion condition', () => {
      const logic = { '>': [{ var: 'emotions.joy' }, 0.5] };

      const description = simulator.describeLeafCondition(logic);

      expect(description).toContain('emotions.joy');
      expect(description).toContain('>');
      expect(description).toContain('0.5');
    });
  });

  describe('clause tracking statistics', () => {
    it('calculates leaf counts accurately for compound tree', () => {
      const logic = {
        'and': [
          { '>': [{ var: 'a' }, 0.1] },
          {
            'or': [
              { '>': [{ var: 'b' }, 0.2] },
              { '>': [{ var: 'c' }, 0.3] },
            ]
          },
          { '>': [{ var: 'd' }, 0.4] },
        ]
      };

      const tree = simulator.buildHierarchicalTree(logic);
      const leafCount = simulator.countLeaves(tree);

      expect(leafCount).toBe(4); // a, b, c, d
    });
  });
});
```

## Verification Commands
```bash
npm run test:unit -- --testPathPattern="monteCarloSimulator.hierarchical" --coverage
```

## Dependencies
- **Depends on**: None (can run independently)
- **Blocks**: None
