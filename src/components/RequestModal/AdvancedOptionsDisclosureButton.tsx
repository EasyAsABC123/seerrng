import DetailDisclosureButton from '@app/components/MediaDetails/DetailDisclosureButton';
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';

const AdvancedOptionsDisclosureButton = ({
  label,
  open,
  pinned,
  onToggle,
  onPin,
  className,
}: {
  label: string;
  open: boolean;
  pinned: boolean;
  onToggle: () => void;
  onPin: () => void;
  className?: string;
}) => (
  <DetailDisclosureButton
    label={label}
    icon={<AdjustmentsHorizontalIcon aria-hidden="true" />}
    open={open}
    onClick={onToggle}
    className={className}
    pinned={pinned}
    onPinClick={onPin}
  />
);

export default AdvancedOptionsDisclosureButton;
