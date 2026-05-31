import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("slot added by A is claimable by B; claim shows up on A", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByLabel("date").fill("2026-12-01");
    await a.getByLabel("time").fill("09:00");
    await a.getByPlaceholder("label (optional, e.g. setup, cleanup)").fill("setup");
    await a.getByRole("button", { name: "+ add shift", exact: true }).click();

    await expect(b.locator(".vol-slot")).toContainText("setup");

    await b.getByPlaceholder("your name").fill("bob");
    await b.locator(".vol-slot").getByRole("button", { name: "+ claim", exact: true }).click();

    await expect(a.locator(".vol-slot-claims")).toContainText(["bob"]);
    await expect(a.locator(".vol-slot-count")).toContainText("1/");
  } finally {
    await cleanup();
  }
});

test("over-capacity warning shows on BOTH peers when claims exceed capacity", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByLabel("date").fill("2026-12-01");
    await a.getByLabel("time").fill("10:00");
    await a.getByLabel("capacity").fill("1");
    await a.getByRole("button", { name: "+ add shift", exact: true }).click();

    await a.getByPlaceholder("your name").fill("alice");
    await a.locator(".vol-slot").getByRole("button", { name: "+ claim", exact: true }).click();
    await b.getByPlaceholder("your name").fill("bob");
    await b.locator(".vol-slot").getByRole("button", { name: "+ claim", exact: true }).click();

    // The "capacity warning" is the advertised core signal — it is derived from
    // the shared claims/slots maps, so it must converge on EVERY peer, not just
    // the one who pushed the last claim. A per-peer-local filled count (each
    // screen only counting its own claim) would leave the other peer at 1/1
    // with no warning — this asserts both screens see 2/1 + ⚠ over.
    await expect(a.locator(".vol-warn")).toBeVisible();
    await expect(a.locator(".vol-slot")).toHaveClass(/is-over/);
    await expect(a.locator(".vol-slot-count")).toContainText("2/1");
    await expect(b.locator(".vol-warn")).toBeVisible();
    await expect(b.locator(".vol-slot")).toHaveClass(/is-over/);
    await expect(b.locator(".vol-slot-count")).toContainText("2/1");
  } finally {
    await cleanup();
  }
});

test("A removing a shift cascade-deletes its claims and clears it on B", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    // A adds a shift, B claims it — shared state now has 1 slot + 1 claim.
    await a.getByLabel("date").fill("2026-12-02");
    await a.getByLabel("time").fill("11:00");
    await a.getByPlaceholder("label (optional, e.g. setup, cleanup)").fill("teardown");
    await a.getByRole("button", { name: "+ add shift", exact: true }).click();

    await expect(b.locator(".vol-slot")).toContainText("teardown");
    await b.getByPlaceholder("your name").fill("bob");
    await b.locator(".vol-slot").getByRole("button", { name: "+ claim", exact: true }).click();
    await expect(a.locator(".vol-slot-claims")).toContainText(["bob"]);

    // A deletes the shift. removeSlot transacts a slot delete + a cascade delete
    // of every claim on that slot. Both deletions must propagate to B, and the
    // signup tally on B must drop back to 0 (proving the claim was really removed
    // from the shared map, not just hidden with the slot row).
    await a
      .locator(".vol-slot")
      .getByRole("button", { name: /remove shift/i })
      .click();

    await expect(b.locator(".vol-slot")).toHaveCount(0);
    await expect(b.locator(".vol-empty")).toBeVisible();
    await expect(b.locator(".vol-status")).toContainText("0 signups");
    await expect(a.locator(".vol-slot")).toHaveCount(0);
    await expect(a.locator(".vol-status")).toContainText("0 signups");
  } finally {
    await cleanup();
  }
});
