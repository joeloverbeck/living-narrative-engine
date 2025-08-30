/**
 * @file Mock MultiTargetResolutionStage for integration tests
 * @description Provides a simple mock that passes through candidate actions without complex target resolution
 */

import { PipelineStage } from '../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../src/actions/pipeline/PipelineResult.js';

/**
 * Creates a mock MultiTargetResolutionStage that bypasses complex target resolution
 * for integration tests that don't specifically need to test target resolution logic
 *
 * @param {object} options - Configuration options
 * @param {string} [options.defaultTargetId] - Default target ID to use for all actions
 * @param {string} [options.defaultTargetName] - Default target display name
 * @returns {PipelineStage} Mock stage instance
 */
export function createMockMultiTargetResolutionStage(options = {}) {
  const { defaultTargetId = 'target1', defaultTargetName = 'Target 1' } =
    options;

  return new (class extends PipelineStage {
    constructor() {
      super('MockMultiTargetResolution');
    }

    async executeInternal(context) {
      // For integration tests, create proper target contexts with default target
      // This allows the ActionFormattingStage to succeed without complex scope evaluation
      const candidateActions = context.candidateActions || context.data?.candidateActions || [];
      
      return PipelineResult.success({
        data: {
          ...context.data,
          actionsWithTargets: candidateActions.map((actionDef) => ({
            actionDef,
            targetContexts: [
              {
                type: 'entity',
                entityId: defaultTargetId,
                displayName: defaultTargetName,
                placeholder: 'target',
              },
            ],
            resolvedTargets: {
              primary: [
                {
                  id: defaultTargetId,
                  displayName: defaultTargetName,
                  entity: null,
                },
              ],
            },
            targetDefinitions: {
              primary: {
                scope: actionDef.scope || actionDef.targets,
                placeholder: 'target',
              },
            },
            isMultiTarget: false,
          })),
        },
      });
    }
  })();
}

/**
 * Creates a mock MultiTargetResolutionStage that returns no targets
 * for tests that need to verify actions are filtered out
 *
 * @returns {PipelineStage} Mock stage instance
 */
export function createEmptyMockMultiTargetResolutionStage() {
  return new (class extends PipelineStage {
    constructor() {
      super('MockMultiTargetResolutionEmpty');
    }

    async executeInternal(context) {
      // Return empty actions to simulate no targets found
      return PipelineResult.success({
        data: {
          ...context.data,
          actionsWithTargets: [],
        },
      });
    }
  })();
}

export default createMockMultiTargetResolutionStage;
