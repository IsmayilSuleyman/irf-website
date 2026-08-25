// Test stub for next/cache: unstable_cache wraps to the bare function and
// the revalidators are no-ops — unit tests exercise logic, not caching.
export const unstable_cache = <T extends (...args: never[]) => unknown>(
  fn: T,
): T => fn;
export const revalidatePath = (): void => {};
export const revalidateTag = (): void => {};
