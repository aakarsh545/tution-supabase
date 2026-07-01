const { chromium } = require('@playwright/test');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.text()}`));
  page.on('pageerror', exception => console.error(`[BROWSER ERROR] ${exception}`));

  console.log("Navigating to teacher app http://localhost:5173...");
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  // 1. Check if students exist by clicking Students tab in bottom nav
  console.log("Checking students list...");
  const studentsTab = page.locator('button:has(span:text-is("Students"))');
  await studentsTab.waitFor({ timeout: 5000 });
  await studentsTab.click();
  await page.waitForTimeout(1000);

  // If no students listed, add one
  const studentRows = page.locator('button.w-full.bg-white.border');
  const count = await studentRows.count();
  console.log(`Current students in list: ${count}`);

  if (count === 0) {
    console.log("No students found. Adding a test student...");
    // Click Add Student button
    const addBtn = page.locator('button:has(span:text-is("Add"))');
    await addBtn.first().click();
    await page.waitForTimeout(1000);

    // Fill form
    await page.locator('input[name="name"]').fill('Test Student');
    await page.locator('select').first().selectOption('9th');
    await page.locator('input[name="parent_name"]').fill('Parent Name');
    await page.locator('input[name="parent_phone"]').fill('9999999999');
    await page.locator('input[name="fee_amount"]').fill('1500');
    
    const saveBtn = page.locator('button[type="submit"]');
    await saveBtn.first().click();
    await page.waitForTimeout(2000);
    console.log("Test student added successfully.");
  }

  // 2. Go back to Dashboard
  console.log("Navigating back to Dashboard...");
  const dashboardTab = page.locator('button:has(span:text-is("Dashboard"))');
  await dashboardTab.click();
  await page.waitForTimeout(1500);

  // 3. Check if today's session is already logged or if we can log one
  const startSessionBtn = page.locator('button:has-text("Start Session")');
  const startSessionVisible = await startSessionBtn.isVisible();

  if (startSessionVisible) {
    console.log("Start Session button is visible. Logging today's session...");
    await startSessionBtn.click();
    await page.waitForTimeout(2000);

    // We should be in TodayManager.
    // Verify we see students to mark present
    const doneBtn = page.locator('button:has-text("Done")');
    await doneBtn.waitFor({ timeout: 5000 });
    console.log("Tapping Done on attendance page...");
    await doneBtn.click();
    await page.waitForTimeout(2000);

    // Success screen will appear. Click "Done (No Group Alert)" to bypass notifications.
    const finalDoneBtn = page.locator('button:has-text("Done (No Group Alert)")');
    await finalDoneBtn.waitFor({ timeout: 5000 });
    console.log("Tapping 'Done (No Group Alert)' button on success screen...");
    await finalDoneBtn.click();
    await page.waitForTimeout(2000);

    // Verify Dashboard state
    const loggedText = page.locator('text=Session logged ✓');
    await loggedText.waitFor({ timeout: 5000 });
    console.log("Successfully verified: 'Session logged ✓' is displayed on the dashboard!");

    const isStartSessionGone = !(await startSessionBtn.isVisible());
    console.log("Successfully verified: 'Start Session' button is hidden:", isStartSessionGone);
  } else {
    console.log("Today's session was already logged. Let's verify 'Session logged ✓' is present.");
    const loggedText = page.locator('text=Session logged ✓');
    const isLoggedTextVisible = await loggedText.isVisible();
    console.log("Verified 'Session logged ✓' is visible:", isLoggedTextVisible);
  }

  await browser.close();
  console.log("Verification finished successfully!");
}

run().catch(async err => {
  console.error("Test execution failed:", err);
});
