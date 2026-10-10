/**
 * Turning a file the farmer picks into a small data URL the profile can hold.
 *
 * There is no backend to upload to, so the photo lives in localStorage beside
 * the rest of the profile. That storage is shared and quota-bound (about 5MB
 * per origin), which is why this module crops to a square, scales down and
 * re-encodes until the result is small enough to keep forever: a 4MB phone
 * photo written as-is would either blow the quota or push the seed catalogue
 * out of storage on the next write.
 */

/** Size of the stored photo (square). */
const TARGET_SIZE = 480;

/** Max size in bytes for the compressed photo. */
const MAX_BYTES = 90_000;

/** Max allowed input size to avoid large files freezing the browser. */
const MAX_INPUT_BYTES = 10 * 1024 * 1024;

/** Approximate size of a base64 data URL in bytes. Used only against a budget. */
function byteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return dataUrl.length;
  // Four base64 characters carry three bytes.
  return Math.round((dataUrl.length - comma - 1) * 0.75);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as an image."));
    };

    image.src = url;
  });
}

/**
 * Center-crops to a square at TARGET_SIZE and encodes to a data URL under
 * MAX_BYTES, dropping quality and then size until it fits.
 *
 * Throws an Error with a message meant for the farmer to read - the dashboard
 * shows it verbatim next to the control that failed.
 */
export async function processFarmerPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (JPG, PNG or WebP).");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("That image is too large. Please choose one under 10MB.");
  }

  const image = await loadImage(file);

  if (image.naturalWidth === 0 || image.naturalHeight === 0) {
    throw new Error("That image has no dimensions we can display.");
  }

  // Square center crop: the source is usually a portrait or a landscape, and
  // scaling it to the box without cropping would stretch the farmer's face.
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const offsetX = (image.naturalWidth - side) / 2;
  const offsetY = (image.naturalHeight - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("This browser could not process the image.");
  }

  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    offsetX,
    offsetY,
    side,
    side,
    0,
    0,
    TARGET_SIZE,
    TARGET_SIZE,
  );

  const attempt = (type: string, quality: number): string =>
    canvas.toDataURL(type, quality);

  // WebP where supported, JPEG everywhere else: Safari only gained canvas WebP
  // encoding recently, and toDataURL falls back to PNG silently - which is the
  // one format that would not fit the budget at 480px.
  const firstTry = attempt("image/webp", 0.85);
  const useWebP = firstTry.startsWith("data:image/webp");
  const encode = (quality: number) =>
    useWebP ? attempt("image/webp", quality) : attempt("image/jpeg", quality);

  // A browser that cannot encode WebP answers with PNG, which blows the budget
  // at 480px - so that result is discarded and JPEG is used instead.
  let dataUrl = useWebP ? firstTry : attempt("image/jpeg", 0.85);

  for (const quality of [0.75, 0.6, 0.45]) {
    if (byteLength(dataUrl) <= MAX_BYTES) break;
    dataUrl = encode(quality);
  }

  if (byteLength(dataUrl) > MAX_BYTES) {
    throw new Error(
      "That image is too heavy to store on this device. Please try a smaller photo.",
    );
  }

  return dataUrl;
}
