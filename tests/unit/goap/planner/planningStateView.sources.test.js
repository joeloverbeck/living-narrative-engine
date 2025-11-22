import { beforeEach, describe, expect, it } from '@jest/globals';
import { createPlanningStateView } from '../../../../src/goap/planner/planningStateView.js';
import {
  PLANNING_STATE_COMPONENT_REASONS,
  PLANNING_STATE_COMPONENT_SOURCES,
} from '../../../../src/goap/planner/planningStateTypes.js';
import {
  clearPlanningStateDiagnostics,
  registerPlanningStateDiagnosticsEventBus,
} from '../../../../src/goap/planner/planningStateDiagnostics.js';

describe('PlanningStateView source resolution edge cases', () => {
  beforeEach(() => {
    clearPlanningStateDiagnostics();
    registerPlanningStateDiagnosticsEventBus({
      dispatch: () => {},
    });
  });

  it('returns null primary source when components register without origins', () => {
    const view = createPlanningStateView(
      { actor: { id: 'actor-null-source', components: { 'core:known': true } } },
      { metadata: { sourceOptions: { forceSourceless: true } } }
    );

    const result = view.hasComponent('actor-null-source', 'core:missing');
    expect(result.reason).toBe(PLANNING_STATE_COMPONENT_REASONS.COMPONENT_MISSING);
    expect(result.source).toBeNull();
  });

  it('falls back to the first recorded source when priority labels do not match', () => {
    const view = createPlanningStateView(
      {
        actor: { id: 'actor-mutable' },
        state: {
          'actor-mutable': {
            components: { 'core:present': { ready: true } },
          },
        },
      },
      { metadata: { sourceOptions: { customSource: 'legacy-source' } } }
    );

    const result = view.hasComponent('actor-mutable', 'core:missing');
    expect(result.source).toBe('legacy-source');
    expect(result.reason).toBe(PLANNING_STATE_COMPONENT_REASONS.COMPONENT_MISSING);
    expect(Object.values(PLANNING_STATE_COMPONENT_SOURCES)).not.toContain(result.source);
  });
});
