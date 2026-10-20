import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  IMAGE_RETRY_DELAYS_MS,
  IMAGE_RETRY_MAX_JITTER_MS,
  getImageRetryDelayMs,
  isRetryableImageUrl,
} from './imageRetry';

describe('image retry', () => {
  it('only retries proxied images', () => {
    assert.equal(isRetryableImageUrl('/imageproxy/tmdb/t/p/w342/a.jpg'), true);
    assert.equal(isRetryableImageUrl('/base/imageproxy/avatar/x'), true);
    assert.equal(
      isRetryableImageUrl('/images/seerr_poster_not_found.png'),
      false
    );
    assert.equal(isRetryableImageUrl('https://image.tmdb.org/a.jpg'), false);
  });

  it('backs off, then gives up so the placeholder can show', () => {
    assert.equal(
      getImageRetryDelayMs(0, () => 0),
      IMAGE_RETRY_DELAYS_MS[0]
    );
    assert.equal(
      getImageRetryDelayMs(1, () => 0),
      IMAGE_RETRY_DELAYS_MS[1]
    );
    assert.equal(
      getImageRetryDelayMs(2, () => 0),
      undefined
    );
  });

  it('adds jitter so failed posters do not retry in lock-step', () => {
    const early = getImageRetryDelayMs(0, () => 0) as number;
    const late = getImageRetryDelayMs(0, () => 0.999) as number;
    assert.ok(late > early);
    assert.ok(late - early < IMAGE_RETRY_MAX_JITTER_MS);
  });
});
