export const users = {
  standard: { username: 'standard_user', password: 'secret_sauce' },
  locked: { username: 'locked_out_user', password: 'secret_sauce' },
} as const;

export const products = {
  backpack: 'Trail Runner Backpack',
  bikeLight: 'Night Ride Bike Light',
} as const;
