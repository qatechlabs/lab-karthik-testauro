import { test, expect } from '../fixtures';
import { users } from '../data/users';

test.describe('Catalogue and cart API @regression', () => {
  test('wrong password is rejected with a stable error code', async ({ request }) => {
    const res = await request.post('/api/auth/login', { data: { username: users.standard.username, password: 'nope' } });
    expect(res.status()).toBe(401);
    expect((await res.json()).error.code).toBe('invalid_credentials');
  });

  test('cart totals add up after two lines', async ({ api }) => {
    await api.login(users.standard.username, users.standard.password);
    const { items } = await api.products();
    expect(items).toHaveLength(12);
    expect(await api.addToCart(items[0].id, 2)).toBeOK();
    expect(await api.addToCart(items[1].id)).toBeOK();
    const cart = await api.cart();
    expect(cart.count).toBe(3);
    expect(cart.subtotal).toBeCloseTo(items[0].price * 2 + items[1].price, 2);
  });
});
