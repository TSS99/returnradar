import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";

test.beforeEach(async ({ request }) => {
  const result = await request.post("/api/delete-data", {
    data: { confirmation: "DELETE ALL MY DATA" },
  });
  expect(result.ok()).toBeTruthy();
});

test("manual purchase, unknown deadline, edit, search, draft, export, delete", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("Your next purchase has a home.")).toBeVisible();
  await page.getByRole("button", { name: "Add your first purchase" }).click();
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Product name").fill("Synthetic test lamp");
  await page
    .getByLabel("Merchant", { exact: false })
    .first()
    .fill("Fictional test shop");
  await page
    .getByRole("button", { name: "Save purchase", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Synthetic test lamp" }),
  ).toBeVisible();
  await expect(page.getByText("Date unknown")).toHaveCount(2);
  await page.getByRole("button", { name: "Edit purchase" }).click();
  await page.getByLabel("Product name").fill("Corrected synthetic lamp");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Corrected synthetic lamp" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Prepare a request" }).click();
  await page.getByRole("button", { name: "Generate draft" }).click();
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true }),
  ).toHaveValue(/Corrected synthetic lamp/);
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Edited synthetic request");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "returnradar-request.txt",
  );
  await page.getByRole("link", { name: "Purchase library" }).click();
  await page
    .getByRole("textbox", { name: "Search purchases" })
    .fill("Corrected");
  await page.getByRole("button", { name: /Corrected synthetic lamp/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete purchase", exact: true })
    .click();
  await expect(page.getByText("Nothing here just yet.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("PDF upload, correction, field confirmation and verified delivery deadline", async ({
  page,
}) => {
  await page.goto("/#add");
  await page
    .getByLabel("Upload PDF receipt")
    .setInputFiles(path.resolve("../sample_data/synthetic-receipt.pdf"));
  await expect(page.getByText("Your receipt is ready to review")).toBeVisible();
  await page.getByLabel("Product name").fill("Corrected receipt headphones");
  await page.getByLabel("I checked the extracted purchase details").check();
  await page.getByLabel("I verified these terms apply").first().check();
  await page
    .getByRole("button", { name: "Save purchase", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Corrected receipt headphones" }),
  ).toBeVisible();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  await expect(page.getByText("Sep 22, 2026", { exact: true })).toBeVisible();
});

test("real demo screenshots, dark theme, mobile navigation and no overflow", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore fictional demo" }).click();
  await expect(page.getByText(/FICTIONAL DEMO ·/)).toBeVisible();
  await expect(
    page.getByText("Studio wireless headphones").first(),
  ).toBeVisible();
  const directory = path.resolve("../docs/screenshots");
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, "overview-light.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: path.join(directory, "overview-dark.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Use light theme" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await expect
    .poll(() =>
      page.locator(".sidebar").evaluate((e) => e.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  await page.screenshot({
    path: path.join(directory, "overview-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Deadline calendar" }).click();
  await expect(
    page.getByRole("heading", { name: "Deadline calendar" }),
  ).toBeVisible();
  const response = await request.get("/api/dashboard");
  expect((await response.json()).total).toBe(5);
});

test("preferences persist, exports download and destructive deletion requires the phrase", async ({
  page,
  request,
}) => {
  await request.post("/api/purchases", {
    data: { product_name: "Synthetic settings item" },
  });
  await page.goto("/#settings");
  await page
    .getByLabel("Default timezone for new purchases")
    .fill("Asia/Kolkata");
  await page.getByLabel("Days before a deadline").fill("3, 1, 0");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Preferences saved.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Default timezone for new purchases"),
  ).toHaveValue("Asia/Kolkata");
  await expect(
    page.getByRole("button", { name: "Delete all local data" }),
  ).toBeDisabled();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export JSON" }).click();
  expect((await download).suggestedFilename()).toBe("returnradar.json");
  await page
    .getByLabel("Type DELETE ALL MY DATA to confirm")
    .fill("DELETE ALL MY DATA");
  await page.getByRole("button", { name: "Delete all local data" }).click();
  await expect(page.getByText("Your next purchase has a home.")).toBeVisible();
});
