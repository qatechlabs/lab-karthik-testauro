# Sauce Demo automation framework

Playwright + TypeScript framework for https://www.saucedemo.com.

## Structure

- `playwright.config.ts`: base URL from `BASE_URL`, retries and HTML report on CI, trace on failure
- `pages/`: page objects, one class per page; all locators live here
- `fixtures.ts`: `test.extend` providing ready page objects (`app`) and a logged-in state
- `data/`: users and test data, unique per run where the app keeps state
- `tests/`: specs grouped by feature and tagged `@smoke` / `@regression`

## Run

```bash
npm install
npx playwright install chromium
npx playwright test                      # everything
npx playwright test --grep @smoke        # smoke only
BASE_URL=https://staging.example.com npx playwright test
npx playwright show-report
```
