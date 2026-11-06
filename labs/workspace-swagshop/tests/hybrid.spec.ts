import { test, expect } from '../fixtures';
import { users, products } from '../data/users';
import { ShopApi } from '../api/shop.api';

test.describe('Cart seeded by API @regression', () => {
  test('items added through the API appear in the cart page', async ({ app, page }) => {
    const api = new ShopApi(page.request); // shares the browser session
    await api.login(users.standard.username, users.standard.password);
    const { items } = await api.products({ q: 'backpack' });
    expect(await api.addToCart(items[0].id)).toBeOK();

    await app.inventory.goto();
    await app.inventory.openCart();
    await expect(app.cart.items).toHaveCount(1);
    await expect(app.cart.names).toHaveText([products.backpack]);
  });
});
