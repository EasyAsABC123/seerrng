import Badge from '@app/components/Common/Badge';
import Tooltip from '@app/components/Common/Tooltip';
import { mapWithConcurrency } from '@app/utils/concurrency';
import defineMessages from '@app/utils/defineMessages';
import { TagIcon } from '@heroicons/react/20/solid';
import type { BlocklistItem } from '@server/interfaces/api/blocklistInterfaces';
import type { Keyword } from '@server/models/common';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Settings', {
  blocklistedTagsText: 'Blocklisted Tags',
});
const KEYWORD_LOOKUP_CONCURRENCY = 8;

interface BlocklistedTagsBadgeProps {
  data: BlocklistItem;
}

const BlocklistedTagsBadge = ({ data }: BlocklistedTagsBadgeProps) => {
  const [tagNamesBlocklistedFor, setTagNamesBlocklistedFor] =
    useState<string>('Loading...');
  const intl = useIntl();

  useEffect(() => {
    if (!data.blocklistedTags) {
      return;
    }

    const controller = new AbortController();
    let active = true;
    const keywordIds = data.blocklistedTags.slice(1, -1).split(',');
    const loadTagNames = async () => {
      try {
        const keywords = await mapWithConcurrency(
          keywordIds,
          KEYWORD_LOOKUP_CONCURRENCY,
          async (keywordId) => {
            const { data } = await axios.get<Keyword | null>(
              `/api/v1/keyword/${keywordId}`,
              { signal: controller.signal }
            );
            return data?.name || `[Invalid: ${keywordId}]`;
          }
        );
        if (active) {
          setTagNamesBlocklistedFor(keywords.join(', '));
        }
      } catch {
        if (active) {
          setTagNamesBlocklistedFor(
            keywordIds.map((keywordId) => `[Invalid: ${keywordId}]`).join(', ')
          );
        }
      }
    };

    void loadTagNames();
    return () => {
      active = false;
      controller.abort();
    };
  }, [data.blocklistedTags]);

  return (
    <Tooltip
      content={tagNamesBlocklistedFor}
      tooltipConfig={{ followCursor: false }}
    >
      <Badge
        badgeType="dark"
        className="items-center border border-red-500 !text-red-400"
      >
        <TagIcon className="mr-1 h-4" />
        {intl.formatMessage(messages.blocklistedTagsText)}
      </Badge>
    </Tooltip>
  );
};

export default BlocklistedTagsBadge;
