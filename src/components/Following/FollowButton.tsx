import Button from '@app/components/Common/Button';
import useFollows, { type FollowInput } from '@app/hooks/useFollows';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Following.FollowButton', {
  follow: 'Follow',
  following: 'Following',
  unfollow: 'Stop Following',
  followed: 'Following {label}. New items will appear on your Following page.',
  unfollowed: 'Stopped following {label}.',
  failed: 'This could not be saved.',
});

interface FollowButtonProps {
  input: FollowInput;
  /** Overrides the default "Follow" caption, e.g. "Follow Future Volumes". */
  label?: string;
  buttonSize?: 'sm' | 'md' | 'default';
}

/** One follow control for every kind of standing interest. */
const FollowButton = ({
  input,
  label,
  buttonSize = 'sm',
}: FollowButtonProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { find, follow, unfollow } = useFollows();
  const [busy, setBusy] = useState(false);
  const existing = find(input.kind, input.subjectKey);

  const toggle = async () => {
    setBusy(true);
    try {
      if (existing) {
        await unfollow(existing.id);
        addToast(
          intl.formatMessage(messages.unfollowed, {
            label: input.subjectLabel,
          }),
          { appearance: 'info', autoDismiss: true }
        );
      } else {
        await follow(input);
        addToast(
          intl.formatMessage(messages.followed, { label: input.subjectLabel }),
          { appearance: 'success', autoDismiss: true }
        );
      }
    } catch {
      addToast(intl.formatMessage(messages.failed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      buttonType={existing ? 'success' : 'default'}
      buttonSize={buttonSize}
      disabled={busy}
      aria-pressed={!!existing}
      onClick={() => void toggle()}
    >
      {existing
        ? intl.formatMessage(messages.following)
        : (label ?? intl.formatMessage(messages.follow))}
    </Button>
  );
};

export default FollowButton;
