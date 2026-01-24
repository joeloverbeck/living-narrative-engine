/**
 * @file Listens for ACTION_DECIDED events and persists cognitive ledger data.
 */

import { persistCognitiveLedger } from './cognitiveLedgerPersistenceHook.js';
import ComponentAccessService from '../entities/componentAccessService.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class
 * @description Consumes ACTION_DECIDED events and persists cognitive ledger data
 * to the actor's cognitive ledger component.
 */
export class CognitiveLedgerPersistenceListener {
  /**
   * Creates an instance of the listener.
   *
   * @param {{
   *   logger: ILogger,
   *   entityManager: IEntityManager,
   *   componentAccessService?: ComponentAccessService
   * }} deps - Dependencies for the listener.
   */
  constructor({
    logger,
    entityManager,
    componentAccessService = new ComponentAccessService(),
  }) {
    this.logger = logger;
    this.entityManager = entityManager;
    this.componentAccessService = componentAccessService;
  }

  /**
   * Handles events emitted after an action decision.
   *
   * @param {{ payload?: { actorId?: string, extractedData?: { cognitive_ledger?: object, cognitiveLedger?: object } } }} event
   *   The event containing any cognitive ledger produced by the decision process.
   */
  handleEvent(event) {
    if (!event || !event.payload) return;

    const { actorId, extractedData } = event.payload;
    if (!actorId) {
      this.logger.warn(
        'CognitiveLedgerPersistenceListener: Received event without actorId'
      );
      return;
    }

    const cognitiveLedger =
      extractedData?.cognitive_ledger ?? extractedData?.cognitiveLedger;

    if (!cognitiveLedger) {
      return;
    }

    const actorEntity = this.entityManager.getEntityInstance(actorId);
    if (!actorEntity) {
      this.logger.warn(
        `CognitiveLedgerPersistenceListener: entity not found for actor ${actorId}`
      );
      return;
    }

    persistCognitiveLedger(
      cognitiveLedger,
      actorEntity,
      this.logger,
      this.componentAccessService
    );
  }
}
