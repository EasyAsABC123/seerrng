import { defaultSliders } from '@server/constants/discover';
import { getRepository } from '@server/datasource';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import DiscoverSlider from './DiscoverSlider';

setupTestDb();

describe('DiscoverSlider bootstrap', () => {
  it('atomically creates one copy of each built-in across concurrent calls', async () => {
    await Promise.all(
      Array.from({ length: 5 }, () => DiscoverSlider.bootstrapSliders())
    );

    const builtIns = await getRepository(DiscoverSlider).find({
      where: { isBuiltIn: true },
    });
    assert.equal(builtIns.length, defaultSliders.length);
    assert.deepEqual(
      [...new Set(builtIns.map((slider) => slider.type))].sort(
        (left, right) => left - right
      ),
      defaultSliders
        .map((slider) => slider.type!)
        .sort((left, right) => left - right)
    );
  });

  it('still permits custom sliders to share a type', async () => {
    const type = defaultSliders[0].type!;
    await getRepository(DiscoverSlider).save([
      new DiscoverSlider({
        type,
        title: 'First custom slider',
        order: 1,
        isBuiltIn: false,
      }),
      new DiscoverSlider({
        type,
        title: 'Second custom slider',
        order: 2,
        isBuiltIn: false,
      }),
    ]);

    assert.equal(
      await getRepository(DiscoverSlider).count({
        where: { type, isBuiltIn: false },
      }),
      2
    );
  });
});
