/**
 * @file Persists cognitive ledger to actor entity with OVERWRITE semantics.
 */

import { COGNITIVE_LEDGER_COMPONENT_ID } from '../constants/componentIds.js';
import ComponentAccessService from '../entities/componentAccessService.js';

/**
 * Persists cognitive ledger data to the actor entity.
 * Uses OVERWRITE semantics (not additive like notes).
 *
 * @param {object|null|undefined} cognitiveLedger - Cognitive ledger data.
 * @param {object} actorEntity - Entity instance (or test double).
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance.
 * @param {ComponentAccessService} [componentAccess] - Component access service.
 */
export function persistCognitiveLedger(
  cognitiveLedger,
  actorEntity,
  logger,
  componentAccess = new ComponentAccessService()
) {
  if (!cognitiveLedger) {
    logger?.debug(
      `CognitiveLedgerPersistence: No cognitive_ledger in response for actor ${actorEntity?.id ?? 'UNKNOWN'}, skipping`
    );
    return;
  }

  const settled = Array.isArray(cognitiveLedger.settled_conclusions)
    ? cognitiveLedger.settled_conclusions.slice(0, 3)
    : [];
  const open = Array.isArray(cognitiveLedger.open_questions)
    ? cognitiveLedger.open_questions.slice(0, 3)
    : [];

  componentAccess.applyComponent(actorEntity, COGNITIVE_LEDGER_COMPONENT_ID, {
    settled_conclusions: settled,
    open_questions: open,
  });

  logger?.debug(
    `CognitiveLedgerPersistence: Persisted ledger for actor ${actorEntity?.id ?? 'UNKNOWN'} (${settled.length} settled, ${open.length} open)`
  );
}
