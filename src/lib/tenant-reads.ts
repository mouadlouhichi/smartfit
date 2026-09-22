/** Independent sections must not erase each other when one index/service fails. */
export async function readTenantSections<T>(tasks: {
  [K in keyof T]: () => Promise<T[K]>;
}): Promise<{ [K in keyof T]: PromiseSettledResult<T[K]> }> {
  const keys = Object.keys(tasks) as (keyof T)[];
  const values = await Promise.allSettled(keys.map((key) => Promise.resolve().then(tasks[key])));
  return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as {
    [K in keyof T]: PromiseSettledResult<T[K]>;
  };
}
