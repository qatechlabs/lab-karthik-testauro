import type { Page } from '@playwright/test';

export class InventoryPage {
  readonly title;
  readonly items;
  readonly badge;
  constructor(private readonly page: Page) {
    this.title = page.getByTestId('title');
    this.items = page.getByTestId('inventory-item');
    this.badge = page.getByTestId('shopping-cart-badge');
  }

  private card(name: string) {
    return this.items.filter({ hasText: name });
  }

  async addToCart(name: string) {
    await this.card(name).getByRole('button', { name: 'Add to cart' }).click();
  }

  async sortBy(value: 'az' | 'za' | 'lohi' | 'hilo') {
    await this.page.getByTestId('product-sort-container').selectOption(value);
  }

  async prices(): Promise<number[]> {
    return (await this.page.getByTestId('inventory-item-price').allTextContents()).map((t) => Number(t.replace('$', '')));
  }

  async openCart() {
    await this.page.getByRole('button', { name: 'Shopping cart' }).click();
  }
}
