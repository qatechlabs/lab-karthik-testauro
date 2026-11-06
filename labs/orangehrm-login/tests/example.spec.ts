import { test, expect } from '@playwright/test';

test('Admin can log in and sees the dashboard', async ({ page }) => {
  await page.goto('/web/index.php/auth/login');
  await page.getByPlaceholder('Username').fill('Admin');
  await page.getByPlaceholder('Password').fill('admin123');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('wrong password shows Invalid credentials', async ({ page }) => {
  await page.goto('/web/index.php/auth/login');
  await page.getByPlaceholder('Username').fill('Admin');
  await page.getByPlaceholder('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByText('Invalid credentials')).toBeVisible();
  await expect(page).toHaveURL(/auth\/login/);
});
