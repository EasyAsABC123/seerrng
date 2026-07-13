import { strictEqual } from 'node:assert';
import { describe, it } from 'node:test';
import {
  getSearchQuery,
  shouldNavigateToSearch,
  shouldSyncSearchInput,
} from './useSearchInput.utils';

describe('getSearchQuery', () => {
  it('accepts only scalar query values', () => {
    strictEqual(getSearchQuery('alien'), 'alien');
    strictEqual(getSearchQuery(['alien', 'aliens']), '');
    strictEqual(getSearchQuery(undefined), '');
  });
});

describe('shouldNavigateToSearch', () => {
  it('does not navigate again when the URL already has the search query', () => {
    strictEqual(
      shouldNavigateToSearch('/search', 'alien', 'alien', true),
      false
    );
  });

  it('navigates when a new debounced query is ready', () => {
    strictEqual(
      shouldNavigateToSearch('/search', 'alien', 'aliens', true),
      true
    );
  });

  it('does not navigate for a closed or empty search', () => {
    strictEqual(shouldNavigateToSearch('/', '', 'alien', false), false);
    strictEqual(shouldNavigateToSearch('/', '', '', true), false);
  });
});

describe('shouldSyncSearchInput', () => {
  it('does not overwrite typing with the stale route query', () => {
    strictEqual(shouldSyncSearchInput('/', '', 'a', '', true), false);
    strictEqual(
      shouldSyncSearchInput('/search', 'alien', 'aliens', 'alien', true),
      false
    );
  });

  it('syncs a settled input after an external route change', () => {
    strictEqual(
      shouldSyncSearchInput('/search', 'aliens', 'alien', 'alien', false),
      true
    );
  });

  it('does not restore the route query while search is being closed', () => {
    strictEqual(shouldSyncSearchInput('/search', 'alien', '', '', true), false);
  });

  it('syncs a query when navigating to search externally', () => {
    strictEqual(shouldSyncSearchInput('/search', 'alien', '', '', false), true);
  });
});
