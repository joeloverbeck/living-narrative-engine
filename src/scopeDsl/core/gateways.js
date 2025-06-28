/**
 * @typedef {object} EntityGateway
 * @property {() => object[]} getEntities
 * @property {(cid: string) => object[]} getEntitiesWithComponent
 * @property {(eid: string, cid: string) => boolean} hasComponent
 * @property {(eid: string, cid: string) => any} getComponentData
 * @property {(eid: string) => object | null} getEntityInstance
 */

/**
 * @typedef {object} LogicEvaluator
 * @property {(rule: object, ctx: object) => boolean} evaluate
 */
