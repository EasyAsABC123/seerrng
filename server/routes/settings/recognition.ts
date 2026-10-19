import { Permission } from '@server/lib/permissions';
import {
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_RECOGNITION_MAX_IMAGE_BYTES,
  getSettings,
  type RecognitionSettings,
} from '@server/lib/settings';
import { authorizedMutation } from '@server/middleware/authorizedMutation';
import { REDACTED_SECRET } from '@server/utils/security';
import { Router } from 'express';

type ParseResult<T> = { value: T } | { error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const MAX_IMAGE_BYTES_LIMIT = 20 * 1024 * 1024;

export const parseRecognitionSettings = (
  value: unknown,
  current: RecognitionSettings
): ParseResult<RecognitionSettings> => {
  if (!isRecord(value)) {
    return { error: 'Recognition settings must be an object.' };
  }

  const enabled = value.enabled ?? current.enabled;
  const localOcr = value.localOcr ?? current.localOcr;
  const externalConsent = value.externalConsent ?? current.externalConsent;
  if (
    typeof enabled !== 'boolean' ||
    typeof localOcr !== 'boolean' ||
    typeof externalConsent !== 'boolean'
  ) {
    return { error: 'Toggles must be true or false.' };
  }

  const visionProvider = value.visionProvider ?? current.visionProvider;
  if (
    visionProvider !== 'none' &&
    visionProvider !== 'anthropic' &&
    visionProvider !== 'openai'
  ) {
    return { error: 'Choose a supported vision provider.' };
  }

  const visionModel =
    value.visionModel === undefined ? current.visionModel : value.visionModel;
  if (
    typeof visionModel !== 'string' ||
    visionModel.length > 100 ||
    (visionModel && !/^[a-z0-9][a-z0-9._\-:@/]*$/i.test(visionModel))
  ) {
    return { error: 'Vision model ID is invalid.' };
  }

  let visionApiKey = current.visionApiKey;
  if (value.clearVisionApiKey === true) {
    visionApiKey = '';
  } else if (
    typeof value.visionApiKey === 'string' &&
    value.visionApiKey !== REDACTED_SECRET &&
    value.visionApiKey !== ''
  ) {
    visionApiKey = value.visionApiKey.trim();
  } else if (
    value.visionApiKey !== undefined &&
    typeof value.visionApiKey !== 'string'
  ) {
    return { error: 'API key is invalid.' };
  }
  if (visionApiKey.length > 512 || /[\s\0]/.test(visionApiKey)) {
    return { error: 'API key is invalid.' };
  }

  const baseUrlValue = value.visionBaseUrl ?? current.visionBaseUrl;
  if (typeof baseUrlValue !== 'string' || baseUrlValue.length > 2048) {
    return { error: 'Vision base URL is invalid.' };
  }
  const visionBaseUrl = baseUrlValue.trim() || DEFAULT_OPENAI_BASE_URL;
  try {
    const parsed = new URL(visionBaseUrl);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error();
    }
  } catch {
    return { error: 'Vision base URL must be an http or https address.' };
  }

  if (visionProvider === 'anthropic' && !visionApiKey) {
    return { error: 'Enter an Anthropic API key to use image recognition.' };
  }
  if (visionProvider === 'openai' && !visionModel.trim()) {
    return { error: 'Enter the model name to use with this server.' };
  }
  if (visionProvider !== 'none' && !externalConsent) {
    return {
      error:
        'Confirm that uploaded images may be sent to the vision provider before enabling it.',
    };
  }

  const maxImageBytes = value.maxImageBytes ?? current.maxImageBytes;
  if (
    typeof maxImageBytes !== 'number' ||
    !Number.isInteger(maxImageBytes) ||
    maxImageBytes < 64 * 1024 ||
    maxImageBytes > MAX_IMAGE_BYTES_LIMIT
  ) {
    return { error: 'Maximum image size must be between 64 KB and 20 MB.' };
  }

  return {
    value: {
      enabled,
      localOcr,
      visionProvider,
      visionApiKey,
      visionModel: visionModel.trim(),
      visionBaseUrl,
      externalConsent,
      maxImageBytes: maxImageBytes || DEFAULT_RECOGNITION_MAX_IMAGE_BYTES,
    },
  };
};

export const recognitionSettingsView = (settings: RecognitionSettings) => ({
  ...settings,
  visionApiKey: settings.visionApiKey ? REDACTED_SECRET : '',
  visionApiKeyConfigured: Boolean(settings.visionApiKey),
});

const recognitionSettingsRoutes = Router();

recognitionSettingsRoutes.get('/', (_req, res) => {
  res.status(200).json(recognitionSettingsView(getSettings().recognition));
});

recognitionSettingsRoutes.put(
  '/',
  authorizedMutation(Permission.ADMIN, async (req, res) => {
    const settings = getSettings();
    const parsed = parseRecognitionSettings(req.body, settings.recognition);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });
    try {
      const saved = await settings.persistSection('recognition', (current) => {
        const locked = parseRecognitionSettings(req.body, current);
        if ('error' in locked) throw new Error(locked.error);
        return locked.value;
      });
      return res.status(200).json(recognitionSettingsView(saved));
    } catch {
      return res
        .status(500)
        .json({ error: 'Recognition settings could not be saved.' });
    }
  })
);

export default recognitionSettingsRoutes;
