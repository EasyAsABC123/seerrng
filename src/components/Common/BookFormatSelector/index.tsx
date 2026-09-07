import BookFormatBadge, {
  type RequestedBookFormat,
} from '@app/components/Common/BookFormatBadge';
import defineMessages from '@app/utils/defineMessages';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Common.BookFormatSelector', {
  format: 'Format',
  formatHint: 'Choose which format Seerr should request.',
  formatUnavailable: 'Not configured',
  formatAvailable: 'Configured',
});

interface BookFormatSelectorProps {
  value: RequestedBookFormat;
  available: Record<RequestedBookFormat, boolean>;
  onChange: (value: RequestedBookFormat) => void;
  className?: string;
}

const BookFormatSelector = ({
  value,
  available,
  onChange,
  className = 'mt-6',
}: BookFormatSelectorProps) => {
  const intl = useIntl();
  const options: RequestedBookFormat[] = ['ebook', 'audiobook', 'both'];

  return (
    <fieldset className={className}>
      <legend className="text-label">
        {intl.formatMessage(messages.format)}
      </legend>
      <p className="mt-1 text-xs text-gray-400">
        {intl.formatMessage(messages.formatHint)}
      </p>
      <div
        className="mt-3 grid gap-2 sm:grid-cols-3"
        role="radiogroup"
        aria-label={intl.formatMessage(messages.format)}
      >
        {options.map((option) => {
          const isSelected = value === option;
          const isAvailable = available[option];

          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={!isAvailable}
              onClick={() => onChange(option)}
              className={`flex min-h-16 min-w-0 flex-col justify-between rounded-lg border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-45 ${
                isSelected
                  ? 'border-indigo-400 bg-indigo-500/20 shadow-sm shadow-indigo-950/40'
                  : 'border-gray-700 bg-gray-900/60 hover:border-gray-500 hover:bg-gray-900'
              }`}
            >
              <BookFormatBadge format={option} variant="selector" />
              <span className="mt-1 text-[11px] text-gray-400">
                {intl.formatMessage(
                  isAvailable
                    ? messages.formatAvailable
                    : messages.formatUnavailable
                )}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
};

export default BookFormatSelector;
