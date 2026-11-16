import type { ReadarrSettings } from '@server/lib/settings';

export type BookServiceFormat = 'ebook' | 'audiobook';

export const isBinderyService = (
  service: Pick<ReadarrSettings, 'backend'>
): boolean => service.backend === 'bindery';

export const getReadarrServiceFormats = (
  service: Pick<ReadarrSettings, 'backend' | 'serviceType'>
): BookServiceFormat[] => {
  if (service.backend !== 'readarr' && service.serviceType === 'both') {
    return ['ebook', 'audiobook'];
  }

  return [service.serviceType === 'audiobook' ? 'audiobook' : 'ebook'];
};

export const readarrServiceSupportsFormat = (
  service: Pick<ReadarrSettings, 'backend' | 'serviceType'>,
  format: BookServiceFormat
): boolean => getReadarrServiceFormats(service).includes(format);

export const getDefaultBookRequestFormat = (
  services: Pick<ReadarrSettings, 'backend' | 'serviceType' | 'isDefault'>[]
): 'ebook' | 'audiobook' | 'both' => {
  const defaults = services.filter((service) => service.isDefault);
  const ebook = defaults.some((service) =>
    readarrServiceSupportsFormat(service, 'ebook')
  );
  const audiobook = defaults.some((service) =>
    readarrServiceSupportsFormat(service, 'audiobook')
  );
  return ebook && audiobook ? 'both' : audiobook ? 'audiobook' : 'ebook';
};
