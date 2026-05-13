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

test("over-capacity warning shows when claims exceed capacity", async ({ browser, baseURL }) => {
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

    await expect(a.locator(".vol-warn")).toBeVisible();
    await expect(a.locator(".vol-slot")).toHaveClass(/is-over/);
  } finally {
    await cleanup();
  }
});
