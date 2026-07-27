import { withSpan } from "@app/otel";

/**
 * Drizzle has no first-party OpenTelemetry instrumentation and postgres-js
 * isn't covered by OTel auto-instrumentation, so we proxy the query-builder
 * surface and open a span around the awaited query. Chain methods
 * (`.from().where()`) return fresh builders, so the proxy is re-applied
 * recursively and only the terminal `await` opens a span.
 *
 * Disable with OTEL_DB_TRACING=false.
 */

const TRACED_OPS = new Set([
  "select",
  "selectDistinct",
  "insert",
  "update",
  "delete",
  "execute",
]);

const CAPTURE_STATEMENT = () => process.env.OTEL_DB_STATEMENT === "true";

function isObject(value: unknown): value is object {
  return (
    (typeof value === "object" || typeof value === "function") && value !== null
  );
}

function captureStatement(
  builder: unknown,
  span: { setAttribute: (k: string, v: string | number) => void },
): void {
  if (!CAPTURE_STATEMENT()) return;
  const toSQL = (builder as { toSQL?: () => { sql?: string } }).toSQL;
  if (typeof toSQL !== "function") return;
  try {
    const { sql } = toSQL.call(builder);
    if (sql) span.setAttribute("db.statement", sql);
  } catch {
    // toSQL can throw on some builder shapes — never let it break the query.
  }
}

function traceBuilder<T extends object>(builder: T, op: string): T {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (prop === "then") {
        if (typeof Reflect.get(target, prop, receiver) !== "function") {
          return undefined;
        }

        return (
          onFulfilled?: ((v: unknown) => unknown) | null,
          onRejected?: ((e: unknown) => unknown) | null,
        ) =>
          withSpan(
            `db.${op}`,
            async (span) => {
              captureStatement(target, span);
              // Resolving the raw thenable runs the query exactly once,
              // bypassing this proxy so there is no recursion.
              return await Promise.resolve(target as PromiseLike<unknown>);
            },
            { attributes: { "db.system": "postgresql", "db.operation": op } },
          ).then(onFulfilled, onRejected);
      }

      if (typeof value === "function") {
        return (...args: unknown[]) => {
          const result = Reflect.apply(value, target, args);
          if (result === target) return receiver;
          if (isObject(result)) {
            return traceBuilder(result, op);
          }
          return result;
        };
      }

      return value;
    },
  });
}

function traceRelationalQuery<T extends object>(query: T): T {
  return new Proxy(query, {
    get(target, table, receiver) {
      const tableApi = Reflect.get(target, table, receiver);
      if (!tableApi || typeof tableApi !== "object") return tableApi;
      return new Proxy(tableApi as object, {
        get(tt, method, rr) {
          const fn = Reflect.get(tt, method, rr);
          if (typeof fn !== "function") return fn;
          return (...args: unknown[]) => {
            const builder = Reflect.apply(fn, tt, args);
            if (isObject(builder)) {
              return traceBuilder(
                builder,
                `query.${String(table)}.${String(method)}`,
              );
            }
            return builder;
          };
        },
      });
    },
  });
}

/**
 * Wraps a Drizzle database (or transaction handle) so every query produces a
 * span. Transactions get their own span with nested query spans inside.
 */
export function instrumentDatabase<T extends object>(database: T): T {
  if (process.env.OTEL_DB_TRACING === "false") return database;

  return new Proxy(database, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (prop === "transaction" && typeof value === "function") {
        return (
          callback: (tx: unknown) => Promise<unknown>,
          ...rest: unknown[]
        ) =>
          withSpan(
            "db.transaction",
            () =>
              Reflect.apply(value, target, [
                (tx: object) => callback(instrumentDatabase(tx)),
                ...rest,
              ]),
            {
              attributes: {
                "db.system": "postgresql",
                "db.operation": "transaction",
              },
            },
          );
      }

      if (prop === "query" && value && typeof value === "object") {
        return traceRelationalQuery(value as object);
      }

      if (typeof value === "function" && TRACED_OPS.has(String(prop))) {
        return (...args: unknown[]) => {
          const builder = Reflect.apply(value, target, args);
          if (isObject(builder)) {
            return traceBuilder(builder, String(prop));
          }
          return builder;
        };
      }

      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
