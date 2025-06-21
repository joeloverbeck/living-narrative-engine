import { cloneDeep } from 'lodash';

/**
 * Deeply clones the provided object using lodash.
 *
 * @template T
 * @param {T} obj - The object to clone.
 * @returns {T} The cloned object.
 */
export default function LodashCloner(obj) {
  return cloneDeep(obj);
}
