# Karthik Kodati's QA automation labs

Code written in the [QA Interview Ready live labs](https://interview.qatechlabs.com/labs), committed here automatically after every run. Each folder under `labs/` is one interview scenario: page objects, fixtures and tests, exactly as written in the browser.

## Run a lab locally

```bash
npm install
npx playwright install chromium
LAB_DIR=labs/swagshop-login npm test
```

`LAB_DIR` picks the scenario folder. `LAB_BASE_URL` overrides the site under test (each practice app lives under https://interview.qatechlabs.com/sandbox/...).

## Run a lab on GitHub Actions

The **Lab run** workflow (Actions tab → Lab run → Run workflow) runs a lab folder against any site and keeps the Playwright report as an artifact. The live labs trigger it for the real-site scenarios.
