import globalMessages from '@app/i18n/globalMessages';
import { BookOpenIcon, SpeakerWaveIcon } from '@heroicons/react/24/outline';
import { useIntl } from 'react-intl';
import { twMerge } from 'tailwind-merge';

export type BookFormat = 'book' | 'ebook' | 'audiobook' | 'both';

export const getBookFormatMessage = (format?: BookFormat | null) => {
  switch (format) {
    case 'ebook':
      return globalMessages.ebook;
    case 'audiobook':
      return globalMessages.audiobook;
    case 'both':
      return globalMessages.ebookAndAudiobook;
    default:
      return globalMessages.book;
  }
};

interface BookFormatBadgeProps {
  format?: BookFormat | null;
  variant?: 'card' | 'compact' | 'inline' | 'selector';
  className?: string;
  showIcon?: boolean;
}

const BookFormatBadge = ({
  format,
  variant = 'compact',
  className,
  showIcon = true,
}: BookFormatBadgeProps) => {
  const intl = useIntl();
  const normalizedFormat = format ?? 'book';
  const label = intl.formatMessage(getBookFormatMessage(normalizedFormat));
  const isAudio = normalizedFormat === 'audiobook';
  const isBoth = normalizedFormat === 'both';
  const Icon = isAudio ? SpeakerWaveIcon : BookOpenIcon;

  const variantClasses = {
    card: 'inline-flex max-w-full items-center gap-1 rounded-full border border-amber-500 bg-amber-600/85 px-2 py-1 text-[11px] font-semibold leading-none text-white shadow-md',
    compact:
      'inline-flex max-w-full items-center gap-1 rounded-full border border-amber-500/70 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold leading-none text-amber-100',
    inline:
      'inline-flex max-w-full items-center gap-1 text-sm font-medium text-amber-100',
    selector:
      'inline-flex min-w-0 items-center gap-2 text-left text-sm font-semibold text-gray-100',
  } as const;

  return (
    <span className={twMerge(variantClasses[variant], className)} title={label}>
      {showIcon &&
        (isBoth ? (
          <span className="flex shrink-0 items-center" aria-hidden="true">
            <BookOpenIcon className="h-3.5 w-3.5" />
            <SpeakerWaveIcon className="-ml-1 h-3.5 w-3.5" />
          </span>
        ) : (
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ))}
      <span className="truncate">{label}</span>
    </span>
  );
};

export default BookFormatBadge;
