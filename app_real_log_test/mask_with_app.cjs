// Applies the app's REAL default privacy masking (backend/pipelineService.ts maskPII, default patterns) to messages.
// Input: JSON array of strings on stdin. Output: JSON array of masked strings on stdout.
// Run from backend/:  node -r ts-node/register/transpile-only ../app_real_log_test/mask_with_app.cjs < in.json
const path = require('path');
const { maskPII } = require(path.join(process.cwd(), 'pipelineService.ts'));
let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  process.stdout.write(JSON.stringify(JSON.parse(input).map((m) => maskPII(m))));
  process.exit(0);
});
