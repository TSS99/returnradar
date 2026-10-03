import { test, expect } from "@playwright/test";
test("sign-in, manual purchase, owner analytics, export, deletion and sign-out", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Sign in with ChatGPT", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Sign in with ChatGPT", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little peace of mind." }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await fetch("/api/delete-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ReturnRadar-Request": "1",
      },
      body: JSON.stringify({ confirmation: "DELETE ALL MY DATA" }),
    });
  });
  await page.reload();
  await page.locator("nav").getByRole("link", { name: "Add purchase" }).click();
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel(/^Product name/).fill("Browser test headphones");
  await page.getByRole("button", { name: /Save purchase/ }).click();
  await expect(
    page.getByRole("heading", { name: "Browser test headphones" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Usage dashboard" }).click();
  await expect(
    page.getByRole("heading", { name: "ReturnRadar usage" }),
  ).toBeVisible();
  await expect(
    page.getByText("Registered users", { exact: true }),
  ).toBeVisible();
  await page.goto("/#settings");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export JSON" }).click();
  expect((await download).suggestedFilename()).toBe("returnradar.json");
  await page
    .getByLabel("Type DELETE ALL MY DATA to confirm")
    .fill("DELETE ALL MY DATA");
  await page.getByRole("button", { name: "Delete all my cloud data" }).click();
  await expect(
    page.getByRole("heading", { name: "A little peace of mind." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Sign in with ChatGPT", exact: true }),
  ).toBeVisible();
});
test("real browser PDF extraction, saved receipt and responsive workspace", async ({
  page,
}) => {
  await page.goto("/signin-with-chatgpt?return_to=%2F");
  await expect(
    page.getByRole("heading", { name: "A little peace of mind." }),
  ).toBeVisible();
  await page.locator("nav").getByRole("link", { name: "Add purchase" }).click();
  await page
    .getByLabel("Upload PDF receipt")
    .setInputFiles("sample_data/synthetic-receipt.pdf");
  await expect(page.getByLabel(/^Product name/)).not.toHaveValue("", {
    timeout: 25000,
  });
  await page.getByRole("button", { name: /Save purchase/ }).click();
  await expect(
    page.getByRole("heading", { name: "Studio wireless headphones" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A little peace of mind." }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
test("public guide and privacy are accessible without sign-in; API is private", async ({
  page,
  request,
}) => {
  await page.goto("/guide");
  await expect(
    page.getByRole("heading", { name: "Use it in ChatGPT" }),
  ).toBeVisible();
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { name: "Usage measurement" }),
  ).toBeVisible();
  expect((await request.get("/api/purchases")).status()).toBe(401);
});
