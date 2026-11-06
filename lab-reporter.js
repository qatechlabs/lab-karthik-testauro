// Records every expect() so the QA Interview Ready labs can grade assertions. Written to assertions.json.
const fs = require('fs');

class LabReporter {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.matchers = [];
  }

  onStepEnd(test, result, step) {
    if (step.category !== 'expect') return;
    const m = step.title.match(/(?:expect\.(?:soft\.|poll\.)?|Expect ")(\w+)/);
    const matcher = m ? m[1] : step.title;
    if (step.error) this.failed += 1;
    else this.passed += 1;
    if (!this.matchers.includes(matcher)) this.matchers.push(matcher);
  }

  onEnd() {
    fs.writeFileSync('assertions.json', JSON.stringify({ passed: this.passed, failed: this.failed, matchers: this.matchers }, null, 2));
  }
}

module.exports = LabReporter;
