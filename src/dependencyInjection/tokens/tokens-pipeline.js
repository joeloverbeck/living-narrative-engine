/**
 * @file tokens-pipeline.js - Pipeline-specific DI tokens for Multi-Target Resolution services
 * @see tokens.js
 */

import { freeze } from '../../utils/cloneUtils.js';

/**
 * @typedef {string} DiToken
 */

/**
 * Pipeline service tokens for multi-target resolution decomposition.
 * These tokens identify services extracted from the MultiTargetResolutionStage monolith.
 *
 * @type {Readonly<Record<string, DiToken>>}
 */
export const pipelineTokens = freeze({
  // Multi-Target Resolution Stage Services
  ITargetDependencyResolver: 'ITargetDependencyResolver',
  ILegacyTargetCompatibilityLayer: 'ILegacyTargetCompatibilityLayer',
  IScopeContextBuilder: 'IScopeContextBuilder',
  ITargetDisplayNameResolver: 'ITargetDisplayNameResolver',
  ITargetResolutionTracingOrchestrator: 'ITargetResolutionTracingOrchestrator',
  ITargetResolutionResultBuilder: 'ITargetResolutionResultBuilder',
  ITargetResolutionCoordinator: 'ITargetResolutionCoordinator',

  // Service Infrastructure
  IPipelineServiceFactory: 'IPipelineServiceFactory',
  IPipelineServiceRegistry: 'IPipelineServiceRegistry',
});
