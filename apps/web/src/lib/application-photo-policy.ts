// Shared contract for the backend and its tests; no UI or uploads happen here.
export const APPLICATION_PHOTO_BUCKET = "application-photos";
export const MAX_APPLICATION_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_APPLICATION_PHOTOS = 5;
export const APPLICATION_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoPurpose = "info_response" | "offer_review";

export function validatePhotoMetadata(photo: { name: string; type: string; size: number }) {
  if (!photo.name.trim() || photo.name.length > 160 || /[\u0000-\u001f\u007f/\\]/.test(photo.name))
    throw new Error("Choose a photo with a valid filename of up to 160 characters.");
  if (!APPLICATION_PHOTO_TYPES.some(type => type === photo.type))
    throw new Error("Only JPEG, PNG and WebP photos are allowed.");
  if (!Number.isSafeInteger(photo.size) || photo.size <= 0 || photo.size > MAX_APPLICATION_PHOTO_BYTES)
    throw new Error("Each photo must be no larger than 5 MB.");
}

/** Basic signature check, not image decoding, malware scanning or proof of content. */
export function photoSignatureMatches(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value);
  if (type === "image/webp") return bytes.length >= 12
    && [82,73,70,70].every((value, index) => bytes[index] === value)
    && [87,69,66,80].every((value, index) => bytes[index + 8] === value);
  return false;
}

export function validateResponsePhotoIds(ids: string[]) {
  if (ids.length > MAX_APPLICATION_PHOTOS || new Set(ids).size !== ids.length
      || ids.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))
    throw new Error("Choose at most five different uploaded photos.");
}
