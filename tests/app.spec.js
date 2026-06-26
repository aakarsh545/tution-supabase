import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const seedStudents = [
  { name: "Rahul Shetty", standard: "9th", parent_name: "Suresh Shetty", parent_phone: "+919876543210", fee_amount: 1500 },
  { name: "Priya Nair", standard: "10th", parent_name: "Ramesh Nair", parent_phone: "+919876543211", fee_amount: 1500 },
  { name: "Arjun Bhat", standard: "8th", parent_name: "Mohan Bhat", parent_phone: "+919876543212", fee_amount: 1200 },
  { name: "Sneha Rao", standard: "10th", parent_name: "Venkat Rao", parent_phone: "+919876543213", fee_amount: 1500 },
  { name: "Kiran Kamath", standard: "9th", parent_name: "Dinesh Kamath", parent_phone: "+919876543214", fee_amount: 1500 }
];

// Helper to clear today's sessions so Start Session button is visible
async function clearTodaySessions() {
  const todayStr = new Date().toISOString().split('T')[0];
  const { data: todaySessions } = await supabase.from('sessions').select('id').eq('date', todayStr);
  if (todaySessions && todaySessions.length > 0) {
    const sessionIds = todaySessions.map(s => s.id);
    await supabase.from('attendance').delete().in('session_id', sessionIds);
    await supabase.from('sessions').delete().in('id', sessionIds);
  }
}

test.beforeAll(async () => {
  // Ensure the 5 seed students exist
  for (const s of seedStudents) {
    const { data } = await supabase.from('students').select('*').eq('name', s.name);
    if (!data || data.length === 0) {
      await supabase.from('students').insert([s]);
    }
  }

  // Cleanup past test artifacts to avoid duplicates and strict mode errors
  await supabase.from('students').delete().eq('name', 'Fee Test Student');
  await supabase.from('tests').delete().eq('test_name', 'E2E Unit Test');
  await supabase.from('notes').delete().like('note', '%helped explain%');
});

test.describe('Tuition Portal End-to-End Tests', () => {

  test.beforeEach(async () => {
    // Clear sessions logged for today before each test so we have a fresh slate
    await clearTodaySessions();
  });

  test('1. Dashboard Stats and Card Navigation', async ({ page }) => {
    await page.goto('/');

    // Verify all 4 stat cards are visible
    await expect(page.getByText('Total Students')).toBeVisible();
    await expect(page.getByText('Present Today')).toBeVisible();
    await expect(page.getByText('Absent Today')).toBeVisible();
    await expect(page.getByText('Pending Fees')).toBeVisible();

    // Verify main action buttons
    await expect(page.getByRole('button', { name: 'Start Session' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark Holiday' })).toBeVisible();
    await expect(page.getByTitle('View Attendance Calendar')).toBeVisible();

    // Click Total Students Card -> Should navigate to Student List
    await page.locator('button:has-text("Total Students")').click();
    await expect(page.locator('h1:has-text("Students")')).toBeVisible();

    // Go back to Dashboard
    await page.getByRole('button', { name: 'Dashboard' }).click();

    // Click Pending Fees Card -> Should navigate to Pending Fees List
    await page.locator('button:has-text("Pending Fees")').click();
    await expect(page.getByText('Pending Fees List')).toBeVisible();
  });

  test('2. Start Session and Attendance Logging Flow', async ({ page }) => {
    await page.goto('/');

    // Start session
    await page.getByRole('button', { name: 'Start Session' }).click();
    await expect(page.getByText('Register Attendance')).toBeVisible();

    // Verify subject dropdown has 6 subjects and select 'Maths'
    const subjectDropdown = page.locator('select');
    await expect(subjectDropdown).toBeVisible();
    await subjectDropdown.selectOption('Maths');

    // All students should be listed (verify Rahul Shetty is visible)
    await expect(page.getByText('Rahul Shetty')).toBeVisible();

    // Toggle Rahul Shetty to Absent (A)
    const rahulRow = page.locator('div.w-full.flex.items-stretch', { hasText: 'Rahul Shetty' }).last();
    await rahulRow.getByRole('button', { name: 'A' }).click();

    // Click Done -> navigate to absent students list
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('ABSENT STUDENTS LIST')).toBeVisible();

    // Verify Rahul Shetty is in the list
    await expect(page.getByText('Rahul Shetty (9th)')).toBeVisible();
    
    // Verify WhatsApp alert button exists
    const alertBtn = page.getByRole('link', { name: 'Send Alert' });
    await expect(alertBtn).toBeVisible();
    await expect(alertBtn).toHaveAttribute('href', /wa\.me/);

    // Mock Notify Parents click (window.open)
    page.on('popup', async popup => {
      await popup.close();
    });
    await page.getByRole('button', { name: 'Notify Parents' }).click();

    // Click Done -> goes back to Dashboard
    await page.getByRole('button', { name: 'Done' }).click();

    // Verify session logged indicator on Dashboard
    await expect(page.getByText('Session logged ✓')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Session' })).not.toBeVisible();
  });

  test('3. Holiday Logging Flow (Cancel & Confirm)', async ({ page }) => {
    await page.goto('/');

    // Dismiss first click
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('Mark today as a holiday?');
      dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Mark Holiday' }).click();
    
    // Buttons should still be visible
    await expect(page.getByRole('button', { name: 'Start Session' })).toBeVisible();

    // Confirm second click
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('Mark today as a holiday?');
      dialog.accept();
    });
    await page.getByRole('button', { name: 'Mark Holiday' }).click();

    // Dashboard shows "Holiday marked ✓"
    await expect(page.getByText('Holiday marked ✓')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Session' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark Holiday' })).not.toBeVisible();
  });

  test('4. Students List Operations (Add, Edit, Filter, Delete)', async ({ page }) => {
    // Navigate to Students tab
    await page.goto('/');
    await page.getByRole('button', { name: 'Students' }).click();

    // Verify all 5 seed students are listed
    await expect(page.getByText('Rahul Shetty')).toBeVisible();
    await expect(page.getByText('Priya Nair')).toBeVisible();
    await expect(page.getByText('Arjun Bhat')).toBeVisible();
    await expect(page.getByText('Sneha Rao')).toBeVisible();
    await expect(page.getByText('Kiran Kamath')).toBeVisible();

    // Test Search filter
    await page.getByPlaceholder('Search student name...').fill('Arjun');
    await expect(page.getByText('Rahul Shetty')).not.toBeVisible();
    await expect(page.getByText('Arjun Bhat')).toBeVisible();

    // Clear search
    await page.getByPlaceholder('Search student name...').fill('');

    // Test Add Student Form
    await page.getByRole('button', { name: 'Add' }).click();
    await page.locator('input[name="name"]').fill('Temp Test Student');
    await page.locator('select[name="standard"]').selectOption('10th');
    await page.locator('input[name="parent_name"]').fill('Temp Parent');
    await page.locator('input[name="parent_phone"]').fill('9988776655');
    await page.locator('input[name="fee_amount"]').fill('2000');
    await page.getByRole('button', { name: 'Enroll Student' }).click();

    // Verify new student is added
    await expect(page.getByText('Temp Test Student')).toBeVisible();

    // Test Edit Student
    await page.getByText('Temp Test Student').click();
    await expect(page.getByText('Student Profile')).toBeVisible();
    
    // Tap Edit icon (index 1 button in header)
    await page.locator('button:has(svg)').nth(1).click();
    await page.locator('input[name="name"]').fill('Temp Test Student Edited');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Verify updated profile name
    await expect(page.getByText('Temp Test Student Edited')).toBeVisible();

    // Test Delete Student (Dismiss confirmation first)
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('Are you sure you want to remove');
      dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Remove Student' }).click();
    await expect(page.getByText('Temp Test Student Edited')).toBeVisible(); // Still exists

    // Confirm Delete
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('Are you sure you want to remove');
      dialog.accept();
    });
    await page.getByRole('button', { name: 'Remove Student' }).click();

    // Verify redirected back to students list and name is gone
    await expect(page.locator('h1:has-text("Students")')).toBeVisible();
    await expect(page.getByText('Temp Test Student Edited')).not.toBeVisible();
  });

  test('5. Fees Dues Recording Flow', async ({ page }) => {
    // We add a temp student to mark their fees paid without affecting seed students
    await page.goto('/');
    await page.getByRole('button', { name: 'Students' }).click();
    await page.getByRole('button', { name: 'Add' }).click();
    await page.locator('input[name="name"]').fill('Fee Test Student');
    await page.locator('input[name="fee_amount"]').fill('1500');
    await page.getByRole('button', { name: 'Enroll Student' }).click();

    // Wait for redirect to complete
    await expect(page.locator('h1:has-text("Students")')).toBeVisible();
    await expect(page.getByText('Fee Test Student')).toBeVisible();

    // Navigate to Fees tab
    await page.getByRole('button', { name: 'Fees' }).click();
    await expect(page.getByText('FEES MANAGEMENT')).toBeVisible();

    // Verify Fee Test Student is in unpaid state (usually red border/white bg)
    const stdBtn = page.locator('button', { hasText: 'Fee Test Student' });
    await expect(stdBtn).toBeVisible();

    // Click student to open payment popup
    await stdBtn.click();
    await expect(page.getByText('Record Fee Payment')).toBeVisible();

    // Save payment
    await page.getByRole('button', { name: 'Save Payment' }).click();

    // Verify green/paid state (button becomes disabled/paid)
    await expect(stdBtn).toBeDisabled();

    // Cleanup: Remove Fee Test Student
    await page.getByRole('button', { name: 'Students' }).click();
    await page.getByText('Fee Test Student').click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Remove Student' }).click();
  });

  test('6. Student Behaviour Logging Flow', async ({ page }) => {
    // Navigate to Behaviour Tab
    await page.goto('/');
    await page.getByRole('button', { name: 'Behaviour' }).click();

    // Click Good Behavior card
    await page.getByRole('button', { name: 'Good Behavior' }).click();
    await expect(page.getByText('Select Student')).toBeVisible();

    // Select Priya Nair
    await page.getByRole('button', { name: 'Priya Nair' }).click();
    await expect(page.getByText('What did they do?')).toBeVisible();

    // Enter description
    await page.locator('textarea').fill('helped explain quadratic formulas');
    
    // Save behaviour (Dismiss alert popup)
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('Behaviour logged successfully');
      dialog.accept();
    });
    await page.getByRole('button', { name: 'Log Behavior' }).click();

    // Verify back to options screen
    await expect(page.getByText('Student Behaviour')).toBeVisible();

    // Go verify behavior tag on Student Profile
    await page.getByRole('button', { name: 'Students' }).click();
    await page.getByText('Priya Nair').click();
    await expect(page.getByText('Majority: Good Behaviour')).toBeVisible();
  });

  test('7. Calendar Grid navigation and Detail View', async ({ page }) => {
    // First, log a session for today so a session exists
    await page.goto('/');
    await page.getByRole('button', { name: 'Start Session' }).click();
    await page.locator('select').selectOption('Science');
    
    // Toggle Rahul Shetty to Absent (A)
    const rahulRow = page.locator('div.w-full.flex.items-stretch', { hasText: 'Rahul Shetty' }).last();
    await rahulRow.getByRole('button', { name: 'A' }).click();

    await page.getByRole('button', { name: 'Done' }).click();
    page.once('popup', async popup => { await popup.close(); });
    await page.getByRole('button', { name: 'Notify Parents' }).click();
    await page.getByRole('button', { name: 'Done' }).click();

    // Click Calendar icon in header
    await page.getByTitle('View Attendance Calendar').click();
    await expect(page.getByText('Attendance Calendar')).toBeVisible();

    // Check today's day number in the grid (which is enabled because session exists)
    const todayDay = new Date().getDate().toString();
    const cell = page.locator('button', { hasText: new RegExp(`^${todayDay}$`) });
    await expect(cell).toBeEnabled();

    // Click today's date cell -> opens detail overlay
    await cell.click();
    await expect(page.getByText('Date Detail')).toBeVisible();
    await expect(page.getByText(/Science/i)).toBeVisible();
    await expect(page.getByText('present, 1 absent out of')).toBeVisible();

    // Return to calendar grid
    await page.locator('button:has(svg.lucide-arrow-left)').click();
    await expect(page.getByText('Attendance Calendar')).toBeVisible();
  });

  test('8. Student Profile Test Scores & Attendance History Toggle', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Students' }).click();
    await page.getByText('Rahul Shetty').click();

    // Click Log Test Score button
    await page.getByRole('button', { name: 'Log Test Score' }).click();
    
    // Fill single test form
    await page.locator('select').selectOption('Science');
    await page.locator('input[placeholder="e.g. Unit Test 1"]').fill('E2E Unit Test');
    await page.locator('input[placeholder="e.g. 50"]').fill('100');
    await page.locator('input[placeholder="e.g. 42"]').fill('95');
    await page.getByRole('button', { name: 'Save score' }).click();

    // Verify test score appears on profile
    await expect(page.getByText('E2E Unit Test').first()).toBeVisible();
    await expect(page.getByText('95/100').first()).toBeVisible();

    // Expand attendance entries list to show full history
    await expect(page.getByText('Show All')).toBeVisible();
    await page.getByText('Show All').click();
    await expect(page.getByText('Show Less')).toBeVisible();
  });

});
