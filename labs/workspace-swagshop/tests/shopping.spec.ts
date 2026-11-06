import { test, expect } from '../fixtures';
import { products } from '../data/users';

test.describe('Shopping @regression', () => {
  test('two items added show in the badge and the cart', async ({ loggedIn: app }) => {
    await app.inventory.addToCart(products.backpack);
    await app.inventory.addToCart(products.bikeLight);
    await expect(app.inventory.badge).toHaveText('2');

    await app.inventory.openCart();
    await expect(app.cart.items).toHaveCount(2);
    await expect(app.cart.names).toHaveText([products.backpack, products.bikeLight]);
  });

  test('sorting low to high orders prices ascending', async ({ loggedIn: app }) => {
    await app.inventory.sortBy('lohi');
    const prices = await app.inventory.prices();
    expect(prices).toHaveLength(12);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
});
