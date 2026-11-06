import { test, expect } from '@playwright/test';

test('standard user can log in', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Username').fill('standard_user');
  await page.getByPlaceholder('Password').fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/inventory/);
  await expect(page.getByTestId('title')).toHaveText('Products');
  await expect(page.getByTestId('inventory-item')).toHaveCount(6);
});
