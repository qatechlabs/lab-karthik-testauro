import { expect, type Page } from '@playwright/test';

export class InventoryPage {
  readonly title;
  readonly items;
  readonly badge;
  constructor(private readonly page: Page) {
    this.title = page.getByTestId('title');
    this.items = page.getByTestId('inventory-item');
    this.badge = page.getByTestId('shopping-cart-badge');
  }

  async addToCart(name: string) {
    const card = this.items.filter({ hasText: name });
    await card.getByRole('button', { name: 'Add to cart' }).click();
    await expect(card.getByRole('button', { name: 'Remove' })).toBeVisible(); // the cart call has completed
  }

  async sortBy(value: 'az' | 'za' | 'lohi' | 'hilo') {
    await this.page.getByTestId('product-sort-container').selectOption(value);
  }

  async prices(): Promise<number[]> {
    return (await this.page.getByTestId('inventory-item-price').allTextContents()).map((t) => Number(t.replace('$', '')));
  }

  async openCart() {
    await this.page.getByTestId('shopping-cart-link').click();
  }
}
