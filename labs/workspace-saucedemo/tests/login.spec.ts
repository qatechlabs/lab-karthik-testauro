import { test, expect } from '../fixtures';
import { users } from '../data/users';

test.describe('Login @smoke', () => {
  test('standard user lands on the products page', async ({ app }) => {
    await app.login.login(users.standard.username, users.standard.password);
    await expect(app.inventory.title).toHaveText('Products');
    await expect(app.inventory.items).toHaveCount(6);
  });

  test('locked out user is told why', async ({ app }) => {
    await app.login.login(users.locked.username, users.locked.password);
    await expect(app.login.error).toContainText('locked out');
  });
});
