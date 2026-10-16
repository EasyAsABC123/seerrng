import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { is4kResolution } from './videoResolution';

describe('video resolution classification', () => {
  it('recognizes full and cropped 4K dimensions', () => {
    assert.equal(is4kResolution('3840x2160'), true);
    assert.equal(is4kResolution('3840 x 1600'), true);
    assert.equal(is4kResolution('2160x3840'), true);
  });

  it('keeps HD and QHD dimensions standard and ignores unknown values', () => {
    assert.equal(is4kResolution('1920x1080'), false);
    assert.equal(is4kResolution('2560x1440'), false);
    assert.equal(is4kResolution(undefined), undefined);
    assert.equal(is4kResolution('2160p'), undefined);
  });
});
