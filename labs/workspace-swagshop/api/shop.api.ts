import type { APIRequestContext } from '@playwright/test';

/** Thin client for the SwagShop REST API (GET /api lists every endpoint). */
export class ShopApi {
  constructor(private readonly request: APIRequestContext) {}

  async login(username: string, password: string) {
    const res = await this.request.post('/api/auth/login', { data: { username, password } });
    if (!res.ok()) throw new Error(`login failed: ${res.status()} ${await res.text()}`);
    return (await res.json()) as { token: string; user: { username: string } };
  }

  async products(params: Record<string, string> = {}) {
    const res = await this.request.get('/api/products', { params });
    return (await res.json()) as { items: { id: number; name: string; price: number }[]; total: number };
  }

  addToCart(productId: number, qty = 1) {
    return this.request.post('/api/cart/items', { data: { productId, qty } });
  }

  async cart() {
    return (await (await this.request.get('/api/cart')).json()) as { count: number; subtotal: number; total: number; items: { productId: number; qty: number }[] };
  }
}
