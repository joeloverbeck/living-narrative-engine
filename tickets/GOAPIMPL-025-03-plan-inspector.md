# GOAPIMPL-025-03: Plan Inspector Tool

**Parent Ticket**: GOAPIMPL-025 (GOAP Debugging Tools)
**Priority**: MEDIUM
**Estimated Effort**: 1 hour
**Dependencies**: GOAPIMPL-025-01 (GoapController Debug API)

## Description

Create a plan inspector tool that displays active GOAP plans in human-readable format. The tool reads plan state via the GoapController debug API and formats it with task details, parameter bindings, and failure tracking.

**Reference**:
- Parent ticket: `tickets/GOAPIMPL-025-goap-debugging-tools.md`
- Validation: `claudedocs/workflow-validation-GOAPIMPL-025.md` (Issue #4)
- Spec: `specs/goap-system-specs.md` lines 507-516

## Acceptance Criteria

- [ ] Displays active plan with goal, tasks, and current step
- [ ] Shows task parameters with resolved entity IDs
- [ ] Includes failure tracking (failed goals/tasks count)
- [ ] Formats output as readable text
- [ ] Handles no active plan gracefully
- [ ] Returns JSON format option for tooling
- [ ] Unit tests validate formatting
- [ ] Manual testing confirms readability

## Current State Analysis

### Plan Structure (from GoapController)

```javascript
{
  goal: {
    id: 'stay_fed',
    priority: 10,
    actorId: 'actor-123'
  },
  tasks: [
    { taskId: 'consume_nourishing_item', params: { item: 'food-1' } },
    { taskId: 'gather_resources', params: { resourceType: 'food', location: 'forest-1' } }
  ],
  currentStep: 1,
  actorId: 'actor-123',
  createdAt: 1234567890,
  lastValidated: 1234567892
}
```

### Data Registry

From `src/data/dataRegistry.js`:
- Access goal definitions: `getGoal(goalId)`
- Access task definitions: `getTask(taskId)`
- Provides metadata like description, display name

## Implementation Details

### File to Create

`src/goap/debug/planInspector.js`

```javascript
/**
 * @file Plan inspector for visualizing GOAP plans
 */

import { assertPresent, assertNonBlankString } from '../../utils/dependencyUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Formats GOAP plans in human-readable format for debugging.
 */
class PlanInspector {
  #goapController;
  #dataRegistry;
  #entityManager;
  #logger;

  /**
   * @param {object} deps
   * @param {object} deps.goapController - GOAP controller with debug API
   * @param {object} deps.dataRegistry - Access to goal/task definitions
   * @param {object} deps.entityManager - Access to entity data
   * @param {object} deps.logger - Logger instance
   */
  constructor({ goapController, dataRegistry, entityManager, logger }) {
    validateDependency(goapController, 'IGoapController', logger, {
      requiredMethods: ['getActivePlan', 'getFailedGoals', 'getFailedTasks'],
    });
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getGoal', 'getTask'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityName', 'entityExists'],
    });
    
    this.#goapController = goapController;
    this.#dataRegistry = dataRegistry;
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Inspect active plan for an actor.
   * @param {string} actorId - Actor entity ID
   * @returns {string} Formatted plan text or "No active plan"
   */
  inspect(actorId) {
    assertNonBlankString(actorId, 'actorId', 'PlanInspector.inspect', this.#logger);
    
    const plan = this.#goapController.getActivePlan(actorId);
    
    if (!plan) {
      return this.#formatNoActivePlan(actorId);
    }
    
    return this.#formatPlan(plan);
  }

  /**
   * Get plan as JSON object for tooling.
   * @param {string} actorId - Actor entity ID
   * @returns {object|null} Plan data or null
   */
  inspectJSON(actorId) {
    assertNonBlankString(actorId, 'actorId', 'PlanInspector.inspectJSON', this.#logger);
    
    const plan = this.#goapController.getActivePlan(actorId);
    const failedGoals = this.#goapController.getFailedGoals(actorId);
    const failedTasks = this.#goapController.getFailedTasks(actorId);
    
    if (!plan) {
      return null;
    }
    
    return {
      plan,
      failedGoals,
      failedTasks,
      timestamp: Date.now(),
    };
  }

  /**
   * Format a single task with definition metadata.
   * @param {object} task - Task from plan
   * @param {number} index - Task index
   * @param {number} currentStep - Current step index
   * @returns {string} Formatted task
   */
  #formatTask(task, index, currentStep) {
    const taskDef = this.#dataRegistry.getTask(task.taskId);
    const status = index === currentStep ? 'CURRENT' :
                   index < currentStep ? 'COMPLETED' : 'PENDING';
    
    let output = `  ${index + 1}. [${task.taskId}] (${status})\n`;
    
    if (taskDef && taskDef.description) {
      output += `     ${taskDef.description}\n`;
    }
    
    if (task.params && Object.keys(task.params).length > 0) {
      output += `     Parameters:\n`;
      for (const [key, value] of Object.entries(task.params)) {
        output += this.#formatParameter(key, value);
      }
    }
    
    return output;
  }

  /**
   * Format a parameter with entity name if applicable.
   * @param {string} key - Parameter key
   * @param {*} value - Parameter value
   * @returns {string} Formatted parameter line
   */
  #formatParameter(key, value) {
    // Check if value looks like entity ID
    if (typeof value === 'string' && this.#entityManager.entityExists(value)) {
      const entityName = this.#entityManager.getEntityName(value);
      return `       - ${key}: "${entityName}" (${value})\n`;
    }
    
    // Format as simple value
    const displayValue = typeof value === 'string' ? `"${value}"` : value;
    return `       - ${key}: ${displayValue}\n`;
  }

  /**
   * Format complete plan with all sections.
   * @param {object} plan - Plan from GoapController
   * @returns {string} Formatted output
   */
  #formatPlan(plan) {
    const goalDef = this.#dataRegistry.getGoal(plan.goal.id);
    const failedGoals = this.#goapController.getFailedGoals(plan.actorId);
    const failedTasks = this.#goapController.getFailedTasks(plan.actorId);
    
    let output = '';
    output += `=== GOAP Plan: Achieve '${plan.goal.id}' ===\n`;
    output += `Actor: ${plan.actorId}\n`;
    
    if (goalDef && goalDef.description) {
      output += `Goal: ${goalDef.description}\n`;
    }
    
    output += `Goal Priority: ${plan.goal.priority}\n`;
    output += `Plan Length: ${plan.tasks.length} tasks\n`;
    output += `Created: ${new Date(plan.createdAt).toISOString()}\n`;
    output += `Last Validated: ${new Date(plan.lastValidated).toISOString()}\n`;
    output += `\n`;
    
    output += `Tasks:\n`;
    for (let i = 0; i < plan.tasks.length; i++) {
      output += this.#formatTask(plan.tasks[i], i, plan.currentStep);
      output += `\n`;
    }
    
    output += `Failure Tracking:\n`;
    output += `  Failed Goals: ${failedGoals.length}\n`;
    output += `  Failed Tasks: ${failedTasks.length}\n`;
    output += `\n`;
    
    output += `=== End Plan ===\n`;
    
    return output;
  }

  /**
   * Format "no active plan" message.
   * @param {string} actorId - Actor entity ID
   * @returns {string} Formatted message
   */
  #formatNoActivePlan(actorId) {
    return `=== GOAP Plan Status ===\n` +
           `Actor: ${actorId}\n` +
           `Status: No active plan\n` +
           `=== End ===\n`;
  }
}

export default PlanInspector;
```

## Testing Requirements

### Unit Tests

Create: `tests/unit/goap/debug/planInspector.test.js`

**Test Cases**:

1. **No Active Plan**:
   - Returns "No active plan" message
   - Includes actor ID

2. **Active Plan**:
   - Includes goal ID and priority
   - Lists all tasks in order
   - Shows current step marker
   - Formats timestamps correctly

3. **Task Formatting**:
   - Shows task status (COMPLETED/CURRENT/PENDING)
   - Includes task description from DataRegistry
   - Formats parameters correctly
   - Handles missing task definitions

4. **Entity Resolution**:
   - Resolves entity IDs to names
   - Shows both name and ID for entities
   - Handles non-entity parameters

5. **Failure Tracking**:
   - Shows failed goals count
   - Shows failed tasks count

6. **JSON Output**:
   - Returns null when no plan
   - Returns plan object with metadata
   - Includes failure data

**Test Structure**:
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import PlanInspector from '../../../../src/goap/debug/planInspector.js';

describe('PlanInspector', () => {
  let testBed;
  let inspector;
  let mockController;
  let mockDataRegistry;
  let mockEntityManager;

  beforeEach(() => {
    testBed = createTestBed();
    
    mockController = testBed.createMock('IGoapController', [
      'getActivePlan',
      'getFailedGoals',
      'getFailedTasks',
    ]);
    
    mockDataRegistry = testBed.createMock('IDataRegistry', [
      'getGoal',
      'getTask',
    ]);
    
    mockEntityManager = testBed.createMock('IEntityManager', [
      'getEntityName',
      'entityExists',
    ]);
    
    inspector = new PlanInspector({
      goapController: mockController,
      dataRegistry: mockDataRegistry,
      entityManager: mockEntityManager,
      logger: testBed.createMockLogger(),
    });
  });

  describe('inspect', () => {
    it('should return no plan message when no active plan', () => {
      mockController.getActivePlan.mockReturnValue(null);
      
      const output = inspector.inspect('actor-1');
      
      expect(output).toContain('No active plan');
      expect(output).toContain('actor-1');
    });

    it('should format active plan with goal and tasks', () => {
      const plan = {
        goal: { id: 'stay_fed', priority: 10 },
        tasks: [
          { taskId: 'consume_nourishing_item', params: { item: 'food-1' } },
        ],
        currentStep: 0,
        actorId: 'actor-1',
        createdAt: Date.now(),
        lastValidated: Date.now(),
      };
      
      mockController.getActivePlan.mockReturnValue(plan);
      mockController.getFailedGoals.mockReturnValue([]);
      mockController.getFailedTasks.mockReturnValue([]);
      mockDataRegistry.getGoal.mockReturnValue({ description: 'Maintain nourishment' });
      mockDataRegistry.getTask.mockReturnValue({ description: 'Eat food' });
      mockEntityManager.entityExists.mockReturnValue(true);
      mockEntityManager.getEntityName.mockReturnValue('Apple');
      
      const output = inspector.inspect('actor-1');
      
      expect(output).toContain('stay_fed');
      expect(output).toContain('consume_nourishing_item');
      expect(output).toContain('CURRENT');
      expect(output).toContain('Apple');
    });
  });

  // ... other test suites
});
```

## Manual Testing

1. **Console Usage**:
   ```javascript
   const debugger = container.resolve(tokens.IGOAPDebugger);
   const plan = debugger.inspectPlan('actor-123');
   console.log(plan);
   ```

2. **Expected Output**:
   ```
   === GOAP Plan: Achieve 'stay_fed' ===
   Actor: actor-123
   Goal: Maintain nourishment
   Goal Priority: 10
   Plan Length: 2 tasks
   Created: 2025-11-16T12:34:56.789Z
   Last Validated: 2025-11-16T12:34:58.123Z

   Tasks:
     1. [consume_nourishing_item] (COMPLETED)
        Eat food to restore energy
        Parameters:
          - item: "Apple" (food-1)

     2. [gather_resources] (CURRENT)
        Collect resources from location
        Parameters:
          - resourceType: "food"
          - location: "Forest" (forest-1)

   Failure Tracking:
     Failed Goals: 0
     Failed Tasks: 0

   === End Plan ===
   ```

## Success Validation

✅ **Done when**:
- PlanInspector class implemented
- Text and JSON output modes working
- Entity ID resolution functional
- Failure tracking displayed
- Unit tests pass with coverage
- Manual testing confirms readability
- No TypeScript errors
- No ESLint errors

## References

- Parent: `tickets/GOAPIMPL-025-goap-debugging-tools.md`
- Controller API: `tickets/GOAPIMPL-025-01-goapcontroller-debug-api.md`
- Plan structure: `src/goap/controllers/goapController.js` lines 491-507
- Data registry: `src/data/dataRegistry.js`
- Validation: `claudedocs/workflow-validation-GOAPIMPL-025.md`
