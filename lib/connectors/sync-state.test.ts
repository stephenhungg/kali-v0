import { afterEach, describe, expect, test } from "bun:test";
import {
  ensureEntry,
  getSyncState,
  initAllAndTrack,
  listSyncStates,
  markError,
  markSynced,
  markSyncing,
  trackInit,
  __resetSyncStates,
  __syncStateSize,
} from "./sync-state";

afterEach(() => __resetSyncStates());

describe("ensureEntry", () => {
  test("creates a new 'never' entry for an unknown connector", () => {
    const e = ensureEntry("bloomerang", "Bloomerang");
    expect(e.connectorId).toBe("bloomerang");
    expect(e.status).toBe("never");
    expect(e.lastSyncAt).toBeNull();
    expect(__syncStateSize()).toBe(1);
  });

  test("returns the same entry on repeat call", () => {
    const a = ensureEntry("bloomerang", "Bloomerang");
    const b = ensureEntry("bloomerang", "Bloomerang");
    expect(a).toBe(b);
  });

  test("updates label if it changes", () => {
    const e = ensureEntry("bloomerang", "Old Label");
    ensureEntry("bloomerang", "Bloomerang");
    expect(e.label).toBe("Bloomerang");
  });
});

describe("status transitions", () => {
  test("syncing → connected sets lastSyncAt + lastSuccessAt", () => {
    markSyncing("bloomerang", "Bloomerang");
    markSynced("bloomerang", "Bloomerang", { recordCount: 830 });
    const e = getSyncState("bloomerang")!;
    expect(e.status).toBe("connected");
    expect(e.lastSyncAt).not.toBeNull();
    expect(e.lastSuccessAt).not.toBeNull();
    expect(e.recordCount).toBe(830);
    expect(e.lastError).toBeUndefined();
  });

  test("error preserves the previous lastSuccessAt", async () => {
    markSynced("bloomerang", "Bloomerang", { recordCount: 1 });
    const successAt = getSyncState("bloomerang")!.lastSuccessAt;
    // sleep a tick so timestamps differ
    await new Promise((r) => setTimeout(r, 5));
    markError("bloomerang", "Bloomerang", "boom");
    const e = getSyncState("bloomerang")!;
    expect(e.status).toBe("error");
    expect(e.lastError).toBe("boom");
    expect(e.lastSuccessAt).toBe(successAt);
    expect(e.lastSyncAt! > successAt!).toBe(true);
  });

  test("syncing clears a previous error", () => {
    markError("bloomerang", "Bloomerang", "boom");
    markSyncing("bloomerang", "Bloomerang");
    const e = getSyncState("bloomerang")!;
    expect(e.status).toBe("syncing");
    expect(e.lastError).toBeUndefined();
  });
});

describe("listSyncStates", () => {
  test("returns sorted by connectorId", () => {
    markSynced("solana", "Solana");
    markSynced("bloomerang", "Bloomerang");
    markSynced("m365", "Microsoft 365");
    const all = listSyncStates();
    expect(all.map((e) => e.connectorId)).toEqual([
      "bloomerang",
      "m365",
      "solana",
    ]);
  });
});

describe("trackInit", () => {
  test("marks connected on success and records recordCount", async () => {
    let count = 0;
    await trackInit(
      "bloomerang",
      "Bloomerang",
      async () => {
        count = 830;
      },
      { recordCount: () => count },
    );
    expect(getSyncState("bloomerang")!.status).toBe("connected");
    expect(getSyncState("bloomerang")!.recordCount).toBe(830);
  });

  test("marks error and rethrows on init failure", async () => {
    await expect(
      trackInit("bloomerang", "Bloomerang", async () => {
        throw new Error("seed file missing");
      }),
    ).rejects.toThrow("seed file missing");
    const e = getSyncState("bloomerang")!;
    expect(e.status).toBe("error");
    expect(e.lastError).toBe("seed file missing");
  });
});

describe("initAllAndTrack", () => {
  test("inits each connector and returns list", async () => {
    const all = await initAllAndTrack([
      { id: "bloomerang", label: "Bloomerang", init: async () => {} },
      { id: "salesforce", label: "Salesforce", init: async () => {} },
    ]);
    expect(all.length).toBe(2);
    for (const e of all) expect(e.status).toBe("connected");
  });

  test("connector with no init is marked connected (trivially)", async () => {
    const all = await initAllAndTrack([{ id: "context", label: "Context" }]);
    expect(all[0].status).toBe("connected");
  });

  test("a failing init does not stall the others", async () => {
    const all = await initAllAndTrack([
      {
        id: "bloomerang",
        label: "Bloomerang",
        init: async () => {
          throw new Error("nope");
        },
      },
      { id: "salesforce", label: "Salesforce", init: async () => {} },
    ]);
    expect(all.find((e) => e.connectorId === "bloomerang")!.status).toBe("error");
    expect(all.find((e) => e.connectorId === "salesforce")!.status).toBe("connected");
  });
});
