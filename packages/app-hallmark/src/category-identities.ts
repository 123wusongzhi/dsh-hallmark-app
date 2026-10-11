/** Tool IDs are strings. Convert only exact positive numeric identities; preserve all
 * other source values so malformed or lossy identities cannot become valid IDs. */
export const categoryToolId = (value: unknown): unknown =>
 typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? String(value) : value;
