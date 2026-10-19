import Badge from '@app/components/Common/Badge';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import FollowButton from '@app/components/Following/FollowButton';
import defineMessages from '@app/utils/defineMessages';
import type {
  GameContentItem,
  GameEdition,
  GameEditionsResponse,
} from '@server/api/software/types';
import type { SoftwareSelection } from '@server/entity/SoftwareRequest';
import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.GameContent', {
  heading: 'Editions and Content',
  loading: 'Checking editions…',
  baseOnly: 'The base game only',
  missingSelected: 'Only the content I choose',
  edition: 'A complete edition',
  owned: 'In Your Library',
  baseOwned: 'You already have the base game.',
  baseNotOwned: 'The base game is not in your library yet.',
  story: 'Story',
  cosmetic: 'Cosmetic',
  contentNotListed: 'Content not listed',
  typeExpansion: 'Expansion',
  typeDlc: 'Add-on',
  typeCosmetic: 'Cosmetic',
  typeSeasonPass: 'Season Pass',
  typeBonus: 'Bonus',
  typeSoundtrack: 'Soundtrack',
  typeUnknown: 'Other',
  includes: 'Includes',
  adds: 'This request adds {count, plural, one {# item} other {# items}} you do not have.',
  addsNothing: 'This edition adds nothing you do not already have.',
  unknownContents:
    'The catalog does not say what this edition contains, so what it adds is unknown.',
  chooseAddons: 'Choose the expansions and add-ons you want.',
  nothingChosen: 'Choose at least one item, or switch to the base game.',
  followContent: 'Follow New Story Expansions',
  summary: 'What this request gets',
  summaryBase: 'The base game.',
  summaryAddons: 'Base game (if missing) plus {titles}.',
  summaryEdition: '{title}, including everything in it you do not have.',
});

const typeMessages = {
  expansion: messages.typeExpansion,
  dlc: messages.typeDlc,
  cosmetic: messages.typeCosmetic,
  'season-pass': messages.typeSeasonPass,
  bonus: messages.typeBonus,
  soundtrack: messages.typeSoundtrack,
  unknown: messages.typeUnknown,
} as const;

type Mode = 'base' | 'missing-selected' | 'edition';

interface GameContentPickerProps {
  igdbId: number;
  title: string;
  onChange: (selection: SoftwareSelection | null) => void;
}

const ContentBadges = ({ item }: { item: GameContentItem }) => {
  const intl = useIntl();
  return (
    <span className="media-fact-row">
      <Badge badgeType="primary">
        {intl.formatMessage(typeMessages[item.type])}
      </Badge>
      {item.storyContent === true && (
        <Badge badgeType="success">{intl.formatMessage(messages.story)}</Badge>
      )}
      {item.storyContent === false && (
        <Badge badgeType="default">
          {intl.formatMessage(messages.cosmetic)}
        </Badge>
      )}
      {item.storyContent === null && (
        <Badge badgeType="warning">
          {intl.formatMessage(messages.contentNotListed)}
        </Badge>
      )}
      {item.owned && (
        <Badge badgeType="success">{intl.formatMessage(messages.owned)}</Badge>
      )}
    </span>
  );
};

/**
 * Compare editions and expansions in plain terms and pick exactly the
 * content to acquire. Unknown edition contents stay visibly unknown.
 */
export const GameContentPicker = ({
  igdbId,
  title,
  onChange,
}: GameContentPickerProps) => {
  const intl = useIntl();
  const { data } = useSWR<
    { available: boolean } & Partial<GameEditionsResponse>
  >(`/api/v1/game-content/${igdbId}/editions`, { revalidateOnFocus: false });
  const [mode, setMode] = useState<Mode>('base');
  const [addonIds, setAddonIds] = useState<number[]>([]);
  const [editionId, setEditionId] = useState<number>();

  useEffect(() => {
    if (mode === 'base') onChange(null);
    else if (mode === 'missing-selected') {
      onChange(
        addonIds.length ? { kind: 'game-content', mode, addonIds } : null
      );
    } else {
      onChange(
        editionId
          ? { kind: 'game-content', mode, editionId, addonIds: [] }
          : null
      );
    }
  }, [mode, addonIds, editionId, onChange]);

  const editions = data?.editions ?? [];
  const addons = useMemo(() => data?.addons ?? [], [data?.addons]);
  const chosenEdition = editions.find(
    (edition) => edition.igdbId === editionId
  );

  const editionAdds = (edition: GameEdition) =>
    edition.includes.filter((item) => !item.owned);

  const summary = useMemo(() => {
    if (mode === 'missing-selected' && addonIds.length) {
      return intl.formatMessage(messages.summaryAddons, {
        titles: addons
          .filter((addon) => addonIds.includes(addon.igdbId))
          .map((addon) => addon.title)
          .join(', '),
      });
    }
    if (mode === 'edition' && chosenEdition) {
      return intl.formatMessage(messages.summaryEdition, {
        title: chosenEdition.title,
      });
    }
    return intl.formatMessage(messages.summaryBase);
  }, [mode, addonIds, addons, chosenEdition, intl]);

  if (!data) {
    return (
      <p className="card-subheading" role="status">
        <LoadingSpinner /> {intl.formatMessage(messages.loading)}
      </p>
    );
  }
  if (!data.available || (editions.length === 0 && addons.length === 0))
    return null;

  const toggleAddon = (id: number) =>
    setAddonIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );

  return (
    <section className="app-card-inset card-layout">
      <h3 className="card-title">{intl.formatMessage(messages.heading)}</h3>
      <p className="card-subheading">
        {intl.formatMessage(
          data.base?.owned ? messages.baseOwned : messages.baseNotOwned
        )}
      </p>
      <fieldset className="choice-group">
        {(
          [
            ['base', messages.baseOnly],
            ...(addons.length
              ? [['missing-selected', messages.missingSelected]]
              : []),
            ...(editions.length ? [['edition', messages.edition]] : []),
          ] as [Mode, { id: string; defaultMessage: string }][]
        ).map(([value, label]) => (
          <label key={value} className="card-body-text">
            <input
              type="radio"
              name="game-content-mode"
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            <span>{intl.formatMessage(label)}</span>
          </label>
        ))}
      </fieldset>

      {mode === 'missing-selected' && (
        <>
          <p className="card-subheading">
            {intl.formatMessage(messages.chooseAddons)}
          </p>
          <ul className="card-list" data-list-layout="stacked">
            {addons.map((addon) => (
              <li key={addon.igdbId}>
                <label
                  className="app-card-sub card-layout media-choice-card"
                  data-choice-state={addon.owned ? 'muted' : undefined}
                  data-choice-selected={addonIds.includes(addon.igdbId)}
                >
                  <input
                    type="checkbox"
                    disabled={addon.owned}
                    checked={addonIds.includes(addon.igdbId)}
                    onChange={() => toggleAddon(addon.igdbId)}
                  />
                  <div data-card-part="body">
                    <p className="card-title">{addon.title}</p>
                    <ContentBadges item={addon} />
                    {addon.releaseDate && (
                      <p className="card-subheading">{addon.releaseDate}</p>
                    )}
                  </div>
                </label>
              </li>
            ))}
          </ul>
          {addonIds.length === 0 && (
            <p className="card-subheading">
              {intl.formatMessage(messages.nothingChosen)}
            </p>
          )}
        </>
      )}

      {mode === 'edition' && (
        <ul className="card-list" data-list-layout="stacked">
          {editions.map((edition) => {
            const adds = editionAdds(edition);
            return (
              <li key={edition.igdbId}>
                <label
                  className="app-card-sub card-layout media-choice-card"
                  data-choice-selected={editionId === edition.igdbId}
                >
                  <input
                    type="radio"
                    name="game-edition"
                    checked={editionId === edition.igdbId}
                    onChange={() => setEditionId(edition.igdbId)}
                  />
                  <div data-card-part="body">
                    <p className="card-title">{edition.title}</p>
                    {edition.summary && (
                      <p className="card-body-text">{edition.summary}</p>
                    )}
                    {edition.contentKnown ? (
                      <>
                        <p className="card-subheading">
                          {intl.formatMessage(messages.includes)}
                        </p>
                        <ul>
                          {edition.includes.map((item) => (
                            <li key={item.igdbId} className="card-body-text">
                              {item.title} <ContentBadges item={item} />
                            </li>
                          ))}
                        </ul>
                        <p className="card-body-text">
                          {adds.length
                            ? intl.formatMessage(messages.adds, {
                                count: adds.length,
                              })
                            : intl.formatMessage(messages.addsNothing)}
                        </p>
                      </>
                    ) : (
                      <p className="card-subheading">
                        {intl.formatMessage(messages.unknownContents)}
                      </p>
                    )}
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <p className="card-body-text">
        <strong>{intl.formatMessage(messages.summary)}:</strong> {summary}
      </p>
      <div className="app-action-row">
        <FollowButton
          label={intl.formatMessage(messages.followContent)}
          input={{
            kind: 'expansion',
            subjectKey: `igdb:${igdbId}`,
            subjectLabel: title,
            conditions: { ref: { igdbId, storyOnly: true } },
          }}
        />
      </div>
    </section>
  );
};

export default GameContentPicker;
