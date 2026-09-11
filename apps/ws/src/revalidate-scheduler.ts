/**
 * Debounced, coalescing per-key runner — used to schedule topic access
 * revalidation sweeps.
 *
 * Every revalidated user costs an HTTP round trip to the API's authorize
 * endpoint. Unbounded, a full sweep of a busy topic is a self-inflicted DoS
 * on the API — and a burst of permission changes (every join, every
 * membership toggle) publishes one revalidate message each, so a filling
 * topic was O(N²) serial calls at its peak moment. `schedule(key)` debounces
 * bursts, and if a run is already in flight it queues exactly one follow-up
 * so the last trigger's state is always reflected.
 *
 * Kept free of Bun.serve / Redis so it can be unit-tested with fake timers.
 */

type TimerHandle = ReturnType<typeof setTimeout>;

export interface Timers {
  setTimeout: (fn: () => void, ms: number) => TimerHandle;
  clearTimeout: (handle: TimerHandle) => void;
}

export interface CoalescedRunnerOptions {
  debounceMs: number;
  /** Whether `key` still has anything to run for (e.g. local subscribers).
   *  Inactive keys are never scheduled and their state is dropped as soon as
   *  no run is in flight. */
  isActive: (key: string) => boolean;
  run: (key: string) => Promise<void>;
  /** Injectable timers for tests; defaults to the globals. */
  timers?: Timers;
}

export interface CoalescedRunner {
  /** Request a run for `key` after the debounce window; folds into a pending
   *  window or a running sweep rather than starting another. */
  schedule(key: string): void;
  /** Drop `key`'s state once it goes inactive. A run that is mid-flight keeps
   *  its state object; the run's cleanup finishes the job. */
  clear(key: string): void;
  /** Number of keys with pending or running state (diagnostics / tests). */
  size(): number;
}

interface RunState {
  timer: TimerHandle | null;
  running: boolean;
  rerun: boolean;
}

const defaultTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle),
};

export function createCoalescedRunner(
  options: CoalescedRunnerOptions,
): CoalescedRunner {
  const { debounceMs, isActive, run } = options;
  const timers = options.timers ?? defaultTimers;
  const states = new Map<string, RunState>();

  function clear(key: string): void {
    const state = states.get(key);
    if (!state) return;
    // execute()'s finally re-checks isActive and deletes the entry itself —
    // deleting here would orphan the object the running sweep still holds.
    if (state.running) return;
    if (state.timer !== null) timers.clearTimeout(state.timer);
    states.delete(key);
  }

  function schedule(key: string): void {
    if (!isActive(key)) return;
    const state = states.get(key) ?? {
      timer: null,
      running: false,
      rerun: false,
    };
    states.set(key, state);
    // Already inside a debounce window — this trigger folds into it.
    if (state.timer !== null) return;
    state.timer = timers.setTimeout(() => {
      state.timer = null;
      if (state.running) {
        state.rerun = true;
        return;
      }
      void execute(key, state);
    }, debounceMs);
  }

  async function execute(key: string, state: RunState): Promise<void> {
    state.running = true;
    try {
      await run(key);
    } catch (err) {
      // A failed sweep must not surface as an unhandled rejection; the next
      // trigger simply runs again.
      console.error(
        `[ws] revalidation sweep failed for ${key}:`,
        (err as Error).message,
      );
    } finally {
      state.running = false;
      if (!isActive(key)) {
        // Went inactive mid-sweep — nothing left to run for, and no future
        // trigger will arrive to clean this entry up. Drop it now.
        state.rerun = false;
        if (state.timer !== null) timers.clearTimeout(state.timer);
        state.timer = null;
        states.delete(key);
      } else if (state.rerun) {
        state.rerun = false;
        schedule(key);
      }
    }
  }

  return { schedule, clear, size: () => states.size };
}
