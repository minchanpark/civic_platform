const MEBIBYTE = 1024 * 1024;

export const ISSUE_PHOTO_UPLOAD_TARGET_BYTES = 3 * MEBIBYTE;

const MAX_SOURCE_BYTES = 30 * MEBIBYTE;
const MAX_OUTPUT_DIMENSION = 3200;
const MIN_OUTPUT_DIMENSION = 960;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const JPEG_QUALITIES = [0.82, 0.72, 0.62, 0.52];

export class IssuePhotoPreparationError extends Error {
  constructor() {
    super("The issue photo could not be prepared for upload.");
    this.name = "IssuePhotoPreparationError";
  }
}

function jpegName(name: string) {
  const baseName = name.replace(/\.[^.]+$/, "").trim() || "issue-photo";
  return `${baseName}.jpg`;
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new IssuePhotoPreparationError());
    }, "image/jpeg", quality);
  });
}

async function loadImage(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;

  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new IssuePhotoPreparationError();
  }

  if (!image.naturalWidth || !image.naturalHeight) {
    URL.revokeObjectURL(objectUrl);
    throw new IssuePhotoPreparationError();
  }

  return { image, objectUrl };
}

export async function prepareIssuePhoto(file: File) {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type) || file.size < 1 || file.size > MAX_SOURCE_BYTES) {
    throw new IssuePhotoPreparationError();
  }
  if (file.size <= ISSUE_PHOTO_UPLOAD_TARGET_BYTES) return file;

  const { image, objectUrl } = await loadImage(file);
  try {
    const initialScale = Math.min(1, MAX_OUTPUT_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    let width = Math.max(1, Math.round(image.naturalWidth * initialScale));
    let height = Math.max(1, Math.round(image.naturalHeight * initialScale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new IssuePhotoPreparationError();

    while (true) {
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      for (const quality of JPEG_QUALITIES) {
        const blob = await canvasToJpeg(canvas, quality);
        if (blob.size <= ISSUE_PHOTO_UPLOAD_TARGET_BYTES) {
          return new File([blob], jpegName(file.name), {
            type: "image/jpeg",
            lastModified: file.lastModified,
          });
        }
      }

      if (Math.max(width, height) <= MIN_OUTPUT_DIMENSION) break;
      const scale = Math.max(0.5, MIN_OUTPUT_DIMENSION / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }
  } catch (error) {
    if (error instanceof IssuePhotoPreparationError) throw error;
    throw new IssuePhotoPreparationError();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  throw new IssuePhotoPreparationError();
}
