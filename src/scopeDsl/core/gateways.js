/**
 * @typedef {Object} EntityGateway
 * @property {() => Object[]} getEntities
 * @property {(cid: string) => Object[]} getEntitiesWithComponent
 * @property {(eid: string, cid: string) => boolean} hasComponent
 * @property {(eid: string, cid: string) => any} getComponentData
 * @property {(eid: string) => Object|null} getEntityInstance
 */

/**
 * @typedef {Object} LogicEvaluator
 * @property {(rule: Object, ctx: Object) => boolean} evaluate
 */