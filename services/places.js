const PHOTO_CACHE_TTL_MS = 60 * 60 * 1000;
const EMPTY_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHED_PHOTOS = 200;
const photoCache = new Map();
const pendingPhotos = new Map();

async function fetchGoogle(url, options, operation, apiKey) {
  try {
    return await fetch(url, options);
  } catch (error) {
    const message = String(error?.message || "network error")
      .split(apiKey)
      .join("[redacted]");
    const requestError = new Error(`Google Places ${operation} request failed: ${message}`);
    requestError.status = 502;
    throw requestError;
  }
}

async function throwGoogleError(response, operation, apiKey) {
  const data = await response.json().catch(() => null);
  const providerError = data?.error;
  const details = [
    providerError?.status,
    providerError?.message,
  ].filter(Boolean).join(": ");
  const safeDetails = apiKey ? details.split(apiKey).join("[redacted]") : details;
  const error = new Error(
    `Google Places ${operation} failed with HTTP ${response.status}${safeDetails ? ` (${safeDetails})` : ""}`
  );
  error.status = 502;
  throw error;
}

async function loadPlacePhoto(query) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    const error = new Error("GOOGLE_PLACES_API_KEY is not set");
    error.status = 503;
    throw error;
  }

  const searchResponse = await fetchGoogle("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.photos",
    },
    body: JSON.stringify({ textQuery: query, pageSize: 5 }),
  }, "Text Search", apiKey);
  if (!searchResponse.ok) {
    await throwGoogleError(searchResponse, "Text Search", apiKey);
  }

  const searchData = await searchResponse.json();
  const places = Array.isArray(searchData.places) ? searchData.places : [];
  const candidates = places.flatMap((place) => {
    const photo = Array.isArray(place.photos)
      ? place.photos.find((item) => item?.name)
      : null;
    return photo ? [{ place, photo }] : [];
  });

  console.info("Google Places Text Search completed", {
    query,
    placeCount: places.length,
    placesWithPhotos: candidates.length,
  });

  if (candidates.length === 0) {
    console.info("Google Places returned no photo candidates", { query });
    return null;
  }

  const { place, photo } = candidates[0];
  const photoUrl = new URL(`https://places.googleapis.com/v1/${photo.name}/media`);
  photoUrl.search = new URLSearchParams({
    maxHeightPx: "1000",
    maxWidthPx: "1000",
    key: apiKey,
  });

  const photoResponse = await fetchGoogle(photoUrl, undefined, "photo media", apiKey);
  if (!photoResponse.ok) {
    await throwGoogleError(photoResponse, "photo media", apiKey);
  }

  const contentType = photoResponse.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    throw new Error("Google Places returned a non-image response");
  }

  console.info("Google Places photo media retrieved", {
    query,
    placeName: place.displayName?.text || "unknown",
    status: photoResponse.status,
    contentType,
  });

  return {
    data: Buffer.from(await photoResponse.arrayBuffer()),
    contentType,
  };
}

export async function getPlacePhoto(query) {
  const cacheKey = query.trim().replace(/\s+/g, " ").toLowerCase();
  const cached = photoCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.photo;
  }
  photoCache.delete(cacheKey);

  if (pendingPhotos.has(cacheKey)) {
    return pendingPhotos.get(cacheKey);
  }

  const request = loadPlacePhoto(query)
    .then((photo) => {
      photoCache.set(cacheKey, {
        photo,
        expiresAt: Date.now() + (photo ? PHOTO_CACHE_TTL_MS : EMPTY_CACHE_TTL_MS),
      });
      if (photoCache.size > MAX_CACHED_PHOTOS) {
        photoCache.delete(photoCache.keys().next().value);
      }
      return photo;
    })
    .finally(() => {
      pendingPhotos.delete(cacheKey);
    });

  pendingPhotos.set(cacheKey, request);
  return request;
}
