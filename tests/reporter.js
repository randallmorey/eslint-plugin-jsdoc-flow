// Test reporter:  a numbered line per test, then a summary.  `npm test` uses it.
import { format } from 'node:util';

const SUMMARY = /^(tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) /;

const colorful = process.env.FORCE_COLOR
  ? process.env.FORCE_COLOR !== '0'
  : process.stdout.hasColors?.();
const paint = (code) => (text) =>
  colorful ? `\x1b[${code}m${text}\x1b[0m` : text;
const red = paint(31);
const green = paint(32);
const blue = paint(34);
const white = paint(37);

const round = (number) => Number(number.toFixed(6));

const isTest = ({ type, data }) =>
  (type === 'test:pass' || type === 'test:fail') &&
  data.details.type !== 'suite';

// Node counts tests only once they've all run, so numbers are padded for up to
// 10,000 tests rather than for the actual count.
const NUMBER_WIDTH = 5;

export default async function* reporter(source) {
  const failures = [];
  const summary = {};
  let number = 0;

  for await (const event of source) {
    const { type, data } = event;
    if (isTest(event)) {
      number += 1;
      const passed = type === 'test:pass';
      const tint = passed ? green : red;
      const index = tint(String(number).padStart(NUMBER_WIDTH));
      const mark = tint(passed ? '✓' : '✗');
      const duration = blue(`(${round(data.details.duration_ms)}ms)`);
      yield `${index} ${mark} ${data.name} ${duration}\n`;
      if (!passed) failures.push(data);
    } else if (type === 'test:stdout' || type === 'test:stderr') {
      yield data.message;
    } else if (type === 'test:diagnostic') {
      if (SUMMARY.test(data.message)) {
        const [key, value] = data.message.split(' ');
        summary[key] = value;
      } else {
        yield `${data.message}\n`;
      }
    }
  }

  // Nothing else says why a test failed.
  for (const { name, details } of failures) {
    const { error } = details;
    yield `\n${red('✗')} ${name}\n${format(error.cause ?? error)}\n`;
  }

  yield '\n';
  summary.duration_s = round(summary.duration_ms / 1000);
  const labelWidth = Math.max(...Object.keys(summary).map((k) => k.length));
  for (const [key, value] of Object.entries(summary)) {
    yield `# ${white(key.padEnd(labelWidth))} ${blue(value)}\n`;
  }
}
