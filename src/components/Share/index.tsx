import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CoverImage from '@app/components/Common/CoverImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import { detectBarcodes } from '@app/components/Share/barcode';
import {
  requestBodyForCandidate,
  type ShareFormat,
} from '@app/components/Share/requestBody';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import type {
  ResolveCandidate,
  ResolveGroup,
  ResolveResponse,
} from '@server/lib/resolve/types';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { ChangeEvent, ClipboardEvent, DragEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Share', {
  title: 'Share to Request',
  description:
    'Paste a link, an ISBN, or a list of titles, or add a photo or screenshot. Check what was found, then request the ones you want.',
  inputLabel: 'Links, ISBNs, or Titles',
  inputPlaceholder:
    'Paste one title per line, a Steam, IMDb, Letterboxd or bookstore link, or an ISBN',
  find: 'Find Matches',
  finding: 'Looking…',
  addImage: 'Add a Photo or Screenshot',
  dropHint: 'Drop an image here, or paste one.',
  imageReady: 'Image ready: {name}',
  removeImage: 'Remove Image',
  imageNoReader:
    'This server cannot read images yet. An administrator can enable local text recognition or a vision provider in Settings.',
  barcodeFound: 'Found barcode {code} on this device.',
  format: 'Book Format',
  formatEbook: 'Ebook',
  formatAudiobook: 'Audiobook',
  formatHelp: 'Applies to books you request from this page.',
  seasons: 'Series',
  firstSeason: 'First Season',
  allSeasons: 'All Seasons',
  results: 'What We Found',
  noResults: 'Nothing recognizable was found. Try adding a title or author.',
  includeItem: 'Include “{input}”',
  noneOfThese: 'None of these',
  readLink: 'We could not read that link. Search for the title instead.',
  blockedLink: 'That link cannot be opened from this server.',
  noMatch: 'No match for this one. Try a more specific title.',
  songLink: 'This looks like a music clip.',
  identifySong: 'Identify With SongID',
  confidenceHigh: 'Strong Match',
  confidenceModerate: 'Possible Match',
  confidenceLow: 'Weak Match',
  requestSelected:
    'Request {count, plural, one {# Selected Item} other {# Selected Items}}',
  openSelected: 'Open',
  requested: 'Requested {title}.',
  requestedMany: '{count, plural, one {# item} other {# items}} requested.',
  requestFailed: 'Could not request {title}.',
  externalNotice:
    'The image was read by your administrator’s vision provider. Local text recognition was not used.',
  typeMovie: 'Movie',
  typeTv: 'Series',
  typeBook: 'Book',
  typeAlbum: 'Album',
  typeArtist: 'Artist',
  typeGame: 'Game',
  typeAnime: 'Anime',
  unavailable: 'Link and list recognition is turned off on this server.',
  tooLarge: 'That image is larger than this server allows.',
  failed: 'Nothing could be read from that input.',
});

const typeMessages = {
  movie: messages.typeMovie,
  tv: messages.typeTv,
  book: messages.typeBook,
  album: messages.typeAlbum,
  artist: messages.typeArtist,
  game: messages.typeGame,
  anime: messages.typeAnime,
} as const;

const confidenceMessages = {
  high: messages.confidenceHigh,
  moderate: messages.confidenceModerate,
  low: messages.confidenceLow,
} as const;

interface Capabilities {
  enabled: boolean;
  image: boolean;
  maxImageBytes: number;
}

/** index of the chosen candidate per group; -1 means "none of these". */
type Choices = Record<number, number>;

const isImage = (file: File | null | undefined): file is File =>
  !!file && file.type.startsWith('image/');

const Share = () => {
  const intl = useIntl();
  const router = useRouter();
  const { addToast } = useToasts();
  const { data: capabilities } = useSWR<Capabilities>(
    '/api/v1/resolve/capabilities'
  );
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [format, setFormat] = useState<ShareFormat>('ebook');
  const [seriesSeasons, setSeriesSeasons] = useState<'first' | 'all'>('first');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [response, setResponse] = useState<ResolveResponse>();
  const [choices, setChoices] = useState<Choices>({});
  const [included, setIncluded] = useState<Record<number, boolean>>({});
  const [notice, setNotice] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const picked = useRef(false);

  const acceptImage = useCallback(
    async (file: File) => {
      setImage(file);
      const codes = await detectBarcodes(file);
      const isbn = codes.find((code) => /^97[89]\d{10}$/.test(code));
      if (isbn) {
        setText((current) =>
          current.includes(isbn) ? current : `${current}\n${isbn}`.trim()
        );
        setNotice(intl.formatMessage(messages.barcodeFound, { code: isbn }));
      }
    },
    [intl]
  );

  // Content handed over by the system Share menu (service worker inbox).
  useEffect(() => {
    if (!router.isReady || picked.current) return;
    picked.current = true;
    const { title, text: sharedText, url, image: hasImage } = router.query;
    const parts = [title, sharedText, url]
      .filter((value): value is string => typeof value === 'string' && !!value)
      .filter((value, index, all) => all.indexOf(value) === index);
    if (parts.length) setText(parts.join('\n'));
    if (hasImage === '1' && 'caches' in window) {
      void (async () => {
        try {
          const cache = await caches.open('seerrng-share-inbox');
          const stored = await cache.match('/__share-inbox/image');
          if (stored) {
            const blob = await stored.blob();
            await cache.delete('/__share-inbox/image');
            await acceptImage(
              new File([blob], 'shared-image', {
                type: blob.type || 'image/jpeg',
              })
            );
          }
        } catch {
          // The text part of the share still works.
        }
      })();
    }
  }, [router.isReady, router.query, acceptImage]);

  // The Android app hands a shared image over after the page loads.
  useEffect(() => {
    const receive = () => {
      const shared = (
        window as unknown as {
          __seerrngSharedImage?: { type: string; name: string; base64: string };
        }
      ).__seerrngSharedImage;
      if (!shared) return;
      delete (window as unknown as { __seerrngSharedImage?: unknown })
        .__seerrngSharedImage;
      try {
        const binary = atob(shared.base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        void acceptImage(new File([bytes], shared.name, { type: shared.type }));
      } catch {
        // An unreadable image leaves the text part usable.
      }
    };
    receive();
    window.addEventListener('seerrng-shared-image', receive);
    return () => window.removeEventListener('seerrng-shared-image', receive);
  }, [acceptImage]);

  const applyResponse = (result: ResolveResponse) => {
    setResponse(result);
    setChoices(
      Object.fromEntries(
        result.groups.map((group, index) => [index, group.autoSelected ?? -1])
      )
    );
    setIncluded(
      Object.fromEntries(
        result.groups.map((group, index) => [
          index,
          group.autoSelected !== undefined,
        ])
      )
    );
  };

  const find = async () => {
    setBusy(true);
    setNotice(undefined);
    try {
      let result: ResolveResponse;
      if (image) {
        if (image.size > (capabilities?.maxImageBytes ?? 6 * 1024 * 1024)) {
          addToast(intl.formatMessage(messages.tooLarge), {
            appearance: 'error',
            autoDismiss: true,
          });
          return;
        }
        const fromImage = await axios
          .post<ResolveResponse>(
            `/api/v1/resolve/image?formatHint=${format}`,
            await image.arrayBuffer(),
            {
              headers: {
                'Content-Type': image.type || 'application/octet-stream',
              },
            }
          )
          .then((res) => res.data)
          .catch((error) => {
            if (axios.isAxiosError(error) && error.response?.status === 422) {
              setNotice(intl.formatMessage(messages.imageNoReader));
              return undefined;
            }
            throw error;
          });
        const fromText = text.trim()
          ? (
              await axios.post<ResolveResponse>('/api/v1/resolve', {
                text,
                formatHint: format,
              })
            ).data
          : undefined;
        if (!fromImage && !fromText) return;
        result = {
          groups: [...(fromText?.groups ?? []), ...(fromImage?.groups ?? [])],
          usedExternalProvider: fromImage?.usedExternalProvider,
        };
      } else {
        result = (
          await axios.post<ResolveResponse>('/api/v1/resolve', {
            text,
            formatHint: format,
          })
        ).data;
      }
      applyResponse(result);
    } catch {
      addToast(intl.formatMessage(messages.failed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = Array.from(event.dataTransfer.files).find(isImage);
    if (file) void acceptImage(file);
    else {
      const dropped = event.dataTransfer.getData('text/plain');
      if (dropped) setText((current) => `${current}\n${dropped}`.trim());
    }
  };

  const onPaste = (event: ClipboardEvent) => {
    const file = Array.from(event.clipboardData.files).find(isImage);
    if (file) {
      event.preventDefault();
      void acceptImage(file);
    }
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (isImage(file)) void acceptImage(file);
    event.currentTarget.value = '';
  };

  const chosen = (response?.groups ?? []).flatMap((group, index) => {
    const candidate = group.candidates[choices[index] ?? -1];
    return included[index] && candidate ? [{ group, candidate }] : [];
  });

  const requestSelected = async () => {
    setSubmitting(true);
    let succeeded = 0;
    for (const { candidate } of chosen) {
      const body = requestBodyForCandidate(candidate, {
        format,
        seriesSeasons,
      });
      if (!body) continue;
      try {
        await axios.post('/api/v1/request', body);
        succeeded += 1;
      } catch {
        addToast(
          intl.formatMessage(messages.requestFailed, {
            title: candidate.title,
          }),
          {
            appearance: 'error',
            autoDismiss: true,
          }
        );
      }
    }
    setSubmitting(false);
    if (succeeded) {
      addToast(
        intl.formatMessage(messages.requestedMany, { count: succeeded }),
        {
          appearance: 'success',
          autoDismiss: true,
        }
      );
    }
  };

  const requestableCount = chosen.filter(
    ({ candidate }) =>
      !!requestBodyForCandidate(candidate, { format, seriesSeasons })
  ).length;

  const groupNote = (group: ResolveGroup) => {
    if (group.note === 'unreadable-link') return messages.readLink;
    if (group.note === 'blocked-link') return messages.blockedLink;
    if (group.note === 'song-link') return messages.songLink;
    if (group.note === 'no-match') return messages.noMatch;
    return undefined;
  };

  return (
    <div className="page-layout">
      <PageTitle title={intl.formatMessage(messages.title)} />
      <div className="page-title-row">
        <h1 className="page-title">{intl.formatMessage(messages.title)}</h1>
        {busy && (
          <span className="page-status">
            <LoadingSpinner />
          </span>
        )}
      </div>

      {capabilities && !capabilities.enabled ? (
        <section className="app-card-main card-layout">
          <p className="card-body-text">
            {intl.formatMessage(messages.unavailable)}
          </p>
        </section>
      ) : (
        <section
          className="app-card-main card-layout share-drop-area"
          data-drop-active={dragging}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <p className="card-body-text">
            {intl.formatMessage(messages.description)}
          </p>
          <div className="form-row">
            <label htmlFor="share-input">
              {intl.formatMessage(messages.inputLabel)}
            </label>
            <div className="form-input-area">
              <div className="form-input-field">
                <textarea
                  id="share-input"
                  rows={5}
                  maxLength={16000}
                  value={text}
                  placeholder={intl.formatMessage(messages.inputPlaceholder)}
                  onChange={(event) => setText(event.currentTarget.value)}
                  onPaste={onPaste}
                />
              </div>
            </div>
          </div>

          <div className="media-fact-row">
            <label className="app-button-default" htmlFor="share-image">
              {intl.formatMessage(messages.addImage)}
            </label>
            <input
              id="share-image"
              type="file"
              accept="image/*"
              hidden
              onChange={onFile}
            />
            {image ? (
              <>
                <span className="card-body-text">
                  {intl.formatMessage(messages.imageReady, {
                    name: image.name,
                  })}
                </span>
                <Button
                  buttonType="default"
                  buttonSize="sm"
                  onClick={() => setImage(null)}
                >
                  {intl.formatMessage(messages.removeImage)}
                </Button>
              </>
            ) : (
              <span className="card-subheading">
                {intl.formatMessage(messages.dropHint)}
              </span>
            )}
          </div>
          {capabilities && !capabilities.image && image && (
            <p className="card-body-text" role="status">
              {intl.formatMessage(messages.imageNoReader)}
            </p>
          )}
          {notice && (
            <p className="card-body-text" role="status">
              {notice}
            </p>
          )}

          <fieldset className="choice-group">
            <legend className="card-subheading">
              {intl.formatMessage(messages.format)}
            </legend>
            {(['ebook', 'audiobook'] as const).map((value) => (
              <label key={value} className="card-body-text">
                <input
                  type="radio"
                  name="share-format"
                  checked={format === value}
                  onChange={() => setFormat(value)}
                />
                <span>
                  {intl.formatMessage(
                    value === 'ebook'
                      ? messages.formatEbook
                      : messages.formatAudiobook
                  )}
                </span>
              </label>
            ))}
            <span className="card-subheading">
              {intl.formatMessage(messages.formatHelp)}
            </span>
          </fieldset>

          <div className="app-action-row">
            <Button
              type="button"
              buttonType="primary"
              buttonSize="sm"
              disabled={busy || (!text.trim() && !image)}
              onClick={() => void find()}
            >
              {intl.formatMessage(busy ? messages.finding : messages.find)}
            </Button>
          </div>
        </section>
      )}

      {response && (
        <>
          <h2 className="page-heading">
            {intl.formatMessage(messages.results)}
          </h2>
          {response.usedExternalProvider && (
            <p className="card-subheading">
              {intl.formatMessage(messages.externalNotice)}
            </p>
          )}
          {response.groups.length === 0 ? (
            <section className="app-card-main card-layout">
              <p className="card-body-text">
                {intl.formatMessage(messages.noResults)}
              </p>
            </section>
          ) : (
            <div className="candidate-group">
              {response.groups.map((group, groupIndex) => {
                const note = groupNote(group);
                return (
                  <section
                    key={`${group.input}-${groupIndex}`}
                    className="app-card-main card-layout"
                  >
                    <label className="card-body-text">
                      <input
                        type="checkbox"
                        checked={!!included[groupIndex]}
                        disabled={!group.candidates.length}
                        onChange={(event) =>
                          setIncluded((current) => ({
                            ...current,
                            [groupIndex]: event.currentTarget.checked,
                          }))
                        }
                        aria-label={intl.formatMessage(messages.includeItem, {
                          input: group.input,
                        })}
                      />{' '}
                      <strong>{group.input}</strong>
                    </label>
                    {note && (
                      <p className="card-subheading">
                        {intl.formatMessage(note)}
                      </p>
                    )}
                    {group.note === 'song-link' && (
                      <div className="app-action-row">
                        <Link
                          href={`/identify?source=${encodeURIComponent(group.input)}`}
                          legacyBehavior
                          passHref
                        >
                          <Button as="a" buttonType="primary" buttonSize="sm">
                            {intl.formatMessage(messages.identifySong)}
                          </Button>
                        </Link>
                      </div>
                    )}
                    {group.candidates.length > 0 && (
                      <ul className="card-list" data-list-layout="choices">
                        {group.candidates.map(
                          (candidate: ResolveCandidate, candidateIndex) => {
                            const selected =
                              choices[groupIndex] === candidateIndex;
                            return (
                              <li key={`${candidate.source}-${candidate.id}`}>
                                <label
                                  className="app-card-sub card-layout media-choice-card"
                                  data-choice-selected={selected}
                                >
                                  <input
                                    type="radio"
                                    name={`candidate-${groupIndex}`}
                                    checked={selected}
                                    onChange={() => {
                                      setChoices((current) => ({
                                        ...current,
                                        [groupIndex]: candidateIndex,
                                      }));
                                      setIncluded((current) => ({
                                        ...current,
                                        [groupIndex]: true,
                                      }));
                                    }}
                                  />
                                  <CoverImage
                                    src={candidate.imageUrl}
                                    alt=""
                                    type={
                                      candidate.mediaType === 'movie' ||
                                      candidate.mediaType === 'tv'
                                        ? 'tmdb'
                                        : candidate.mediaType === 'album'
                                          ? 'music'
                                          : 'book'
                                    }
                                    shape={
                                      candidate.mediaType === 'album'
                                        ? 'square'
                                        : 'poster'
                                    }
                                  />
                                  <div data-card-part="body">
                                    <h3 className="card-title">
                                      {candidate.title}
                                    </h3>
                                    <p className="card-subheading">
                                      {[candidate.creator, candidate.year]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </p>
                                    <div className="media-fact-row">
                                      <Badge badgeType="primary">
                                        {intl.formatMessage(
                                          typeMessages[candidate.mediaType]
                                        )}
                                      </Badge>
                                      <Badge
                                        badgeType={
                                          candidate.confidence === 'high'
                                            ? 'success'
                                            : candidate.confidence ===
                                                'moderate'
                                              ? 'warning'
                                              : 'default'
                                        }
                                      >
                                        {intl.formatMessage(
                                          confidenceMessages[
                                            candidate.confidence
                                          ]
                                        )}
                                      </Badge>
                                    </div>
                                    <p className="card-subheading">
                                      {candidate.evidence}
                                    </p>
                                    {candidate.mediaType === 'tv' &&
                                      selected && (
                                        <fieldset className="choice-group">
                                          <legend className="card-subheading">
                                            {intl.formatMessage(
                                              messages.seasons
                                            )}
                                          </legend>
                                          {(['first', 'all'] as const).map(
                                            (value) => (
                                              <label
                                                key={value}
                                                className="card-body-text"
                                              >
                                                <input
                                                  type="radio"
                                                  name="share-seasons"
                                                  checked={
                                                    seriesSeasons === value
                                                  }
                                                  onChange={() =>
                                                    setSeriesSeasons(value)
                                                  }
                                                />
                                                <span>
                                                  {intl.formatMessage(
                                                    value === 'first'
                                                      ? messages.firstSeason
                                                      : messages.allSeasons
                                                  )}
                                                </span>
                                              </label>
                                            )
                                          )}
                                        </fieldset>
                                      )}
                                    <div className="app-action-row">
                                      <Link
                                        href={candidate.href}
                                        legacyBehavior
                                        passHref
                                      >
                                        <Button
                                          as="a"
                                          buttonType="default"
                                          buttonSize="sm"
                                        >
                                          {intl.formatMessage(
                                            messages.openSelected
                                          )}
                                        </Button>
                                      </Link>
                                    </div>
                                  </div>
                                </label>
                              </li>
                            );
                          }
                        )}
                        <li>
                          <label className="app-card-sub card-layout">
                            <input
                              type="radio"
                              name={`candidate-${groupIndex}`}
                              checked={(choices[groupIndex] ?? -1) === -1}
                              onChange={() => {
                                setChoices((current) => ({
                                  ...current,
                                  [groupIndex]: -1,
                                }));
                                setIncluded((current) => ({
                                  ...current,
                                  [groupIndex]: false,
                                }));
                              }}
                            />{' '}
                            <span className="card-body-text">
                              {intl.formatMessage(messages.noneOfThese)}
                            </span>
                          </label>
                        </li>
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}
          {requestableCount > 0 && (
            <div className="app-action-row">
              <Button
                type="button"
                buttonType="primary"
                buttonSize="sm"
                disabled={submitting}
                onClick={() => void requestSelected()}
              >
                {intl.formatMessage(messages.requestSelected, {
                  count: requestableCount,
                })}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Share;
