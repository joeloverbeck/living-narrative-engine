/**
 * @file Helper utilities for working with AIPromptPipeline test beds.
 */

import { expect } from '@jest/globals';
import { AIPromptPipelineDependencySpec } from './pipelineConstants.js';

// Re-export for backward compatibility
export { AIPromptPipelineDependencySpec };

// Import and re-export helper functions from separate file to avoid circular dependencies
export {
  expectSuccessfulGeneration,
  expectGenerationFailure,
} from './pipelineTestHelpers.js';
