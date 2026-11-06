import type { Page } from '@playwright/test';

export class CartPage {
  readonly items;
  readonly names;
  constructor(page: Page) {
    this.items = page.getByTestId('inventory-item');
    this.names = page.getByTestId('inventory-item-name');
  }
}
