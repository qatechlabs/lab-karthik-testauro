import { test as base } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { InventoryPage } from './pages/inventory.page';
import { CartPage } from './pages/cart.page';
import { users } from './data/users';

type Pages = { login: LoginPage; inventory: InventoryPage; cart: CartPage };

export const test = base.extend<{ app: Pages; loggedIn: Pages }>({
  app: async ({ page }, use) => {
    const app = { login: new LoginPage(page), inventory: new InventoryPage(page), cart: new CartPage(page) };
    await app.login.goto();
    await use(app);
  },
  loggedIn: async ({ app }, use) => {
    await app.login.login(users.standard.username, users.standard.password);
    await use(app);
  },
});

export { expect } from '@playwright/test';
