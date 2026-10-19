interface BarcodeDetectorLike {
  detect: (source: ImageBitmap) => Promise<{ rawValue: string }[]>;
}

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

/**
 * Reads EAN-13 / EAN-8 / UPC barcodes on the device, when the browser has the
 * Barcode Detection API. The image never leaves the device for this step.
 */
export const detectBarcodes = async (file: Blob): Promise<string[]> => {
  const Detector = (
    globalThis as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }
  ).BarcodeDetector;
  if (!Detector || typeof createImageBitmap !== 'function') return [];
  try {
    const bitmap = await createImageBitmap(file);
    const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a'] });
    const codes = await detector.detect(bitmap);
    bitmap.close();
    return [...new Set(codes.map((code) => code.rawValue))];
  } catch {
    return [];
  }
};
