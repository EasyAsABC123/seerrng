import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const actionPath = fileURLToPath(
  new URL('../.github/actions/setup-gh-cli/action.yml', import.meta.url)
);

test('release runner GitHub CLI is version and digest pinned', () => {
  const action = readFileSync(actionPath, 'utf8');

  assert.match(action, /version='2\.102\.1'/u);
  assert.match(
    action,
    /77b9e297e94c50336823d0f84de7ef1be60cba704601fa0d98f129f47a94987b/u
  );
  assert.match(action, /expected_checksum='[a-f0-9]{64}'/u);
  assert.match(action, /checksum_output="\$\(sha256sum "\$archive"\)"/u);
  assert.match(action, /actual_checksum="\$\{checksum_output%% \*\}"/u);
  assert.match(action, /actual_checksum.*expected_checksum/u);
  assert.match(action, /RUNNER_OS/u);
  assert.match(action, /RUNNER_ARCH/u);
  assert.match(action, /GITHUB_PATH/u);
});
