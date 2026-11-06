# SwagShop automation framework

Your framework for the SwagShop practice store (Saucedemo-style). Build it the way you would for a client:

- `playwright.config.ts`: testDir, baseURL from `process.env.BASE_URL`, retries, reporter, trace on failure
- `pages/`: one class per page or component
- `fixtures.ts`: `test.extend` with the objects your tests need
- `data/` or `utils/`: users, products, helpers
- `tests/`: specs that read like test cases, grouped with `test.describe` or tagged `@smoke`

Users: standard_user, locked_out_user, problem_user, performance_glitch_user / secret_sauce. Runs in the browser and on GitHub Actions.

<!-- Replace this README with real install/run instructions. The rubric checks that it mentions how to run the suite. -->
