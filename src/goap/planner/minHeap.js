/**
 * @file Binary min-heap for priority queue operations in A* search.
 * Maintains heap property: parent <= children.
 * Time complexity: O(log n) insertion/deletion, O(n) search.
 */

/**
 * Binary min-heap implementation for efficient priority queue operations.
 * Maintains complete binary tree structure with min-heap property.
 *
 * @example
 * // Create heap for PlanningNode objects
 * const openList = new MinHeap((a, b) => a.fScore - b.fScore);
 * openList.push(node);
 * const minNode = openList.pop();
 */
class MinHeap {
  /** @type {Array<unknown>} */
  #items = [];

  /**
   * @type {(a: unknown, b: unknown) => number}
   */
  #compareFn;

  /**
   * Create a binary min-heap with custom comparison function.
   *
   * @param {(a: unknown, b: unknown) => number} compareFn - Comparison function (a, b) => number
   *   Returns: negative if a < b, positive if a > b, 0 if equal
   * @throws {Error} If compareFn is not a function
   * @example
   * // Min-heap for numbers
   * const heap = new MinHeap((a, b) => a - b);
   * @example
   * // Min-heap for PlanningNode by fScore
   * const heap = new MinHeap((a, b) => a.fScore - b.fScore);
   */
  constructor(compareFn) {
    if (typeof compareFn !== 'function') {
      throw new Error('compareFn must be a function');
    }
    this.#compareFn = compareFn;
  }

  /**
   * Add item to heap, maintaining heap property.
   * Time complexity: O(log n)
   *
   * @param {unknown} item - Item to add
   * @example
   * heap.push(node);
   * heap.push(5);
   */
  push(item) {
    this.#items.push(item);
    this.#bubbleUp(this.#items.length - 1);
  }

  /**
   * Remove and return minimum item (root).
   * Time complexity: O(log n)
   *
   * @returns {unknown} Minimum item or undefined if empty
   * @example
   * const min = heap.pop(); // Get smallest item
   * if (min === undefined) {
   *   // Heap was empty
   * }
   */
  pop() {
    if (this.isEmpty()) return undefined;

    const min = this.#items[0];
    const last = this.#items.pop();

    if (!this.isEmpty()) {
      this.#items[0] = last;
      this.#bubbleDown(0);
    }

    return min;
  }

  /**
   * Check if heap is empty.
   *
   * @returns {boolean} True if heap has no items
   * @example
   * if (heap.isEmpty()) {
   *   console.log('Heap is empty');
   * }
   */
  isEmpty() {
    return this.#items.length === 0;
  }

  /**
   * Get number of items in heap.
   *
   * @returns {number} Item count
   * @example
   * console.log(`Heap has ${heap.size} items`);
   */
  get size() {
    return this.#items.length;
  }

  /**
   * Find index of first item matching predicate.
   * Time complexity: O(n) - linear search
   *
   * @param {(item: unknown) => boolean} predicate - Test function (item) => boolean
   * @returns {number} Index or -1 if not found
   * @example
   * const index = heap.findIndex(node => node.id === targetId);
   * if (index !== -1) {
   *   heap.remove(index);
   * }
   */
  findIndex(predicate) {
    return this.#items.findIndex(predicate);
  }

  /**
   * Get item at index without removing.
   *
   * @param {number} index - Array index (0-based)
   * @returns {unknown} Item at index or undefined if out of bounds
   * @example
   * const item = heap.get(0); // Peek at minimum without removing
   */
  get(index) {
    return this.#items[index];
  }

  /**
   * Remove item at specific index, maintaining heap property.
   * Time complexity: O(log n)
   *
   * @param {number} index - Index to remove (0-based)
   * @throws {Error} If index is out of bounds
   * @example
   * heap.remove(5); // Remove item at index 5
   */
  remove(index) {
    if (index < 0 || index >= this.#items.length) {
      throw new Error(`Invalid index: ${index}`);
    }

    const last = this.#items.pop();

    if (index < this.#items.length) {
      this.#items[index] = last;
      // Try both directions since we don't know if replacement is larger or smaller
      this.#bubbleUp(index);
      this.#bubbleDown(index);
    }
  }

  /**
   * Restore heap property upward from index.
   * Swaps with parent while item is less than parent.
   *
   * @private
   * @param {number} index - Starting index
   */
  #bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);

      if (this.#compareFn(this.#items[index], this.#items[parentIndex]) >= 0) {
        break; // Heap property satisfied
      }

      // Swap with parent
      [this.#items[index], this.#items[parentIndex]] = [
        this.#items[parentIndex],
        this.#items[index],
      ];
      index = parentIndex;
    }
  }

  /**
   * Restore heap property downward from index.
   * Swaps with smallest child while item is greater than smallest child.
   *
   * @private
   * @param {number} index - Starting index
   */
  #bubbleDown(index) {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (
        leftChild < this.#items.length &&
        this.#compareFn(this.#items[leftChild], this.#items[smallest]) < 0
      ) {
        smallest = leftChild;
      }

      if (
        rightChild < this.#items.length &&
        this.#compareFn(this.#items[rightChild], this.#items[smallest]) < 0
      ) {
        smallest = rightChild;
      }

      if (smallest === index) {
        break; // Heap property satisfied
      }

      // Swap with smallest child
      [this.#items[index], this.#items[smallest]] = [
        this.#items[smallest],
        this.#items[index],
      ];
      index = smallest;
    }
  }
}

export default MinHeap;
