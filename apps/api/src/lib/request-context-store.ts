import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  requestId: string;
  method: string;
  path: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

export async function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  return await storage.run(context, fn);
}
