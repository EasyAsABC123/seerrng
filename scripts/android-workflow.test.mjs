import * as yaml from 'js-yaml';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const workflow = yaml.load(
  fs.readFileSync(
    path.join(rootDirectory, '.github', 'workflows', 'android.yml'),
    'utf8'
  )
);

test('Android workflow builds, tests on an emulator, and creates a debug APK', () => {
  const job = workflow.jobs.android;
  const sdkInstall = job.steps.find(
    (step) => step.name === 'Install Android SDK and emulator'
  );
  const kvm = job.steps.find(
    (step) => step.name === 'Enable KVM for Android emulator'
  );
  const build = job.steps.find(
    (step) => step.name === 'Run unit and emulator tests, then build debug APK'
  );

  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.ok(workflow.on.pull_request.paths.includes('android/**'));
  assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'));
  assert.match(sdkInstall.run, /system-images;android-36;google_apis;x86_64/u);
  assert.ok(kvm, 'KVM permissions must be prepared before emulator startup');
  assert.match(kvm.run, /sudo chmod 0666 \/dev\/kvm/u);
  assert.match(kvm.run, /-r \/dev\/kvm/u);
  assert.match(kvm.run, /-w \/dev\/kvm/u);
  assert.ok(job.steps.indexOf(kvm) < job.steps.indexOf(build));
  assert.match(build.run, /:app:testDebugUnitTest/u);
  assert.match(build.run, /-p android/u);
  assert.match(build.run, /:app:connectedDebugAndroidTest/u);
  assert.match(build.run, /:app:assembleDebug/u);
  assert.match(build.run, /trap .*adb emu kill/u);
});
