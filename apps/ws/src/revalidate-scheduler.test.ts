import { describe, test, expect, beforeEach } from "bun:test";
import { createCoalescedRunner, type Timers } from "./revalidate-scheduler";

type TimerHandle = ReturnType<typeof setTimeout>;

/** Manual clock: timers fire only when the test advances time. */
class FakeTimers implements Timers {
  private nextId = 1;
  private now = 0;
  readonly pending = new Map<number, { fn: () => void; at: number }>();

  setTimeout = (fn: () => void, ms: number): TimerHandle => {
    const id = this.nextId++;
    this.pending.set(id, { fn, at: this.now + ms });
    return id as unknown as TimerHandle;
  };

  clearTimeout = (handle: TimerHandle): void => {
    this.pending.delete(handle as unknown as number);
  };

  advance(ms: number): void {
    this.now += ms;
    const due = [...this.pending]
      .filter(([, t]) => t.at <= this.now)
      .sort(([, a], [, b]) => a.at - b.at);
    for (const [id, t] of due) {
      this.pending.delete(id);
      t.fn();
    }
  }
}

/** Let the runner's `finally` (a real microtask chain) settle. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const DEBOUNCE = 300;

let timers: FakeTimers;
let active: Set<string>;
let runs: string[];
/** Resolvers for in-flight runs, oldest first. */
let inflight: Array<() => void>;

function makeRunner(run?: (key: string) => Promise<void>) {
  return createCoalescedRunner({
    debounceMs: DEBOUNCE,
    isActive: (key) => active.has(key),
    run:
      run ??
      ((key) => {
        runs.push(key);
        return new Promise<void>((resolve) => inflight.push(resolve));
      }),
    timers,
  });
}

beforeEach(() => {
  timers = new FakeTimers();
  active = new Set(["chat:general"]);
  runs = [];
  inflight = [];
});

describe("createCoalescedRunner", () => {
  test("a burst of schedule() calls yields one run after the debounce", () => {
    const runner = makeRunner();

    runner.schedule("chat:general");
    runner.schedule("chat:general");
    runner.schedule("chat:general");

    timers.advance(DEBOUNCE - 1);
    expect(runs).toEqual([]);

    timers.advance(1);
    expect(runs).toEqual(["chat:general"]);
    expect(timers.pending.size).toBe(0);
  });

  test("ignores keys that are not active", () => {
    const runner = makeRunner();

    runner.schedule("chat:empty");

    expect(runner.size()).toBe(0);
    timers.advance(DEBOUNCE);
    expect(runs).toEqual([]);
  });

  test("schedule() while running queues exactly one follow-up", async () => {
    const runner = makeRunner();

    runner.schedule("chat:general");
    timers.advance(DEBOUNCE);
    expect(runs).toHaveLength(1);

    // Triggers arriving mid-sweep: the debounce window elapses while the
    // first run is still in flight, so they must not start a second one.
    runner.schedule("chat:general");
    runner.schedule("chat:general");
    timers.advance(DEBOUNCE);
    expect(runs).toHaveLength(1);

    inflight.shift()!();
    await flush();

    // The follow-up is re-debounced, then runs once.
    expect(runs).toHaveLength(1);
    timers.advance(DEBOUNCE);
    expect(runs).toHaveLength(2);

    inflight.shift()!();
    await flush();
    timers.advance(DEBOUNCE * 2);
    expect(runs).toHaveLength(2);
    expect(runner.size()).toBe(1);
  });

  test("drops the state when the key went inactive during the run", async () => {
    const runner = makeRunner();

    runner.schedule("chat:general");
    timers.advance(DEBOUNCE);
    expect(runner.size()).toBe(1);

    // Last subscriber leaves mid-sweep; a rerun was queued too.
    runner.schedule("chat:general");
    timers.advance(DEBOUNCE);
    active.delete("chat:general");

    inflight.shift()!();
    await flush();

    expect(runner.size()).toBe(0);
    timers.advance(DEBOUNCE * 2);
    expect(runs).toHaveLength(1);
  });

  test("clear() while running defers deletion to the run's cleanup", async () => {
    const runner = makeRunner();

    runner.schedule("chat:general");
    timers.advance(DEBOUNCE);

    active.delete("chat:general");
    runner.clear("chat:general");
    expect(runner.size()).toBe(1);

    inflight.shift()!();
    await flush();
    expect(runner.size()).toBe(0);
  });

  test("clear() with a pending timer cancels it", () => {
    const runner = makeRunner();

    runner.schedule("chat:general");
    expect(timers.pending.size).toBe(1);

    runner.clear("chat:general");
    expect(timers.pending.size).toBe(0);
    expect(runner.size()).toBe(0);

    timers.advance(DEBOUNCE);
    expect(runs).toEqual([]);
  });

  test("keys are debounced independently", () => {
    active.add("chat:other");
    const runner = makeRunner();

    runner.schedule("chat:general");
    timers.advance(100);
    runner.schedule("chat:other");

    timers.advance(DEBOUNCE - 100);
    expect(runs).toEqual(["chat:general"]);
    timers.advance(100);
    expect(runs).toEqual(["chat:general", "chat:other"]);
  });

  test("a rejected run is contained and later runs still happen", async () => {
    let calls = 0;
    const runner = makeRunner(async () => {
      calls++;
      if (calls === 1) throw new Error("authorize blew up");
    });
    const originalError = console.error;
    console.error = () => {};
    try {
      runner.schedule("chat:general");
      timers.advance(DEBOUNCE);
      await flush();
      expect(calls).toBe(1);
      expect(runner.size()).toBe(1);

      runner.schedule("chat:general");
      timers.advance(DEBOUNCE);
      await flush();
      expect(calls).toBe(2);
    } finally {
      console.error = originalError;
    }
  });
});
