import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const workflowDirectory = path.join(rootDirectory, '.github', 'workflows');
const readWorkflow = (name) =>
  yaml.load(fs.readFileSync(path.join(workflowDirectory, name), 'utf8'));

test('release package channels wait for the reusable release asset build', () => {
  const release = readWorkflow('release.yml');
  const assetBuild = release.jobs['build-release-assets'];
  const packageDispatch = release.jobs['dispatch-package-channels'];
  const dispatchScript = packageDispatch.steps.find(
    (step) => step.name === 'Dispatch package workflows'
  ).run;

  assert.equal(assetBuild.uses, './.github/workflows/release-assets.yml');
  assert.equal(assetBuild.needs, 'publish-release');
  assert.equal(assetBuild.with.tag, '${{ github.ref_name }}');
  assert.deepEqual(packageDispatch.needs, [
    'publish-release',
    'build-release-assets',
  ]);
  assert.doesNotMatch(dispatchScript, /release-assets\.yml/u);
  assert.match(dispatchScript, /release-linux-packages\.yml/u);
});

test('release assets support trusted reuse and main-only manual dispatch', () => {
  const assets = readWorkflow('release-assets.yml');
  const workflowCall = assets.on.workflow_call;
  const resolve = assets.jobs.resolve;

  assert.equal(workflowCall.inputs.tag.required, true);
  assert.equal(workflowCall.inputs.tag.type, 'string');
  assert.match(resolve.if, /github\.event_name != 'workflow_dispatch'/u);
  assert.match(resolve.if, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(
    resolve.steps.find((step) => step.name === 'Resolve version').env
      .RELEASE_TAG,
    /inputs\.tag/u
  );
});
