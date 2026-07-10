const API_BASE_URL =
  "https://api.mangaupdates.com/v1";

const REQUEST_TIMEOUT = 15000;

function normalizeTitle(title) {
  return String(title || "")
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

function getTitleScore(searchTitle, candidateTitle) {
  const search = normalizeTitle(searchTitle);
  const candidate = normalizeTitle(candidateTitle);

  if (!search || !candidate) {
    return 0;
  }

  if (search === candidate) {
    return 100;
  }

  if (
    search.startsWith(candidate) ||
    candidate.startsWith(search)
  ) {
    return 80;
  }

  const searchWords = new Set(search.split(" "));
  const candidateWords = new Set(candidate.split(" "));

  const sharedWords = [...searchWords].filter(word =>
    candidateWords.has(word)
  );

  const allWords = new Set([
    ...searchWords,
    ...candidateWords
  ]);

  return (
    sharedWords.length /
    Math.max(allWords.size, 1)
  ) * 60;
}

function getCandidateTitles(result) {
  return [
    result?.hit_title,
    result?.record?.title
  ].filter(Boolean);
}

function chooseBestSearchResult(results, title) {
  let bestResult = null;
  let bestScore = 0;

  for (const result of results) {
    const score = Math.max(
      ...getCandidateTitles(result).map(candidate =>
        getTitleScore(title, candidate)
      ),
      0
    );

    if (score > bestScore) {
      bestResult = result;
      bestScore = score;
    }
  }

  /*
   * Avoid automatically attaching a clearly unrelated
   * MangaUpdates result to an Anime-Planet title.
   */
  return bestScore >= 40 ? bestResult : null;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();

  const timeout = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body
          ? {
              "Content-Type": "application/json"
            }
          : {}),
        ...options.headers
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(
        `MangaUpdates request failed: ${response.status}`
      );
    }

    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function searchSeries(title) {
  const response = await fetchJson(
    `${API_BASE_URL}/series/search`,
    {
      method: "POST",
      body: JSON.stringify({
        search: title,
        stype: "title"
      })
    }
  );

  const results = Array.isArray(response?.results)
    ? response.results
    : [];

  return chooseBestSearchResult(results, title);
}

async function getSeriesDetails(seriesId) {
  return fetchJson(
    `${API_BASE_URL}/series/${seriesId}`
  );
}

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function parseStatusCount(status, unit) {
  if (!status) {
    return null;
  }

  const singularUnit = unit.replace(/s$/, "");

  const expression = new RegExp(
    `\\b(\\d+(?:\\.\\d+)?)\\s+${singularUnit}s?\\b`,
    "i"
  );

  const match = String(status).match(expression);

  return match ? toNumber(match[1]) : null;
}

function getEnglishPublisher(publishers) {
  if (!Array.isArray(publishers)) {
    return "";
  }

  const publisher = publishers.find(item =>
    /english/i.test(item?.type || "")
  );

  return publisher?.publisher_name || "";
}

function determineTranslationStatus(series) {
  const latestChapter =
    toNumber(series?.latest_chapter) || 0;

  if (series?.completed === true) {
    return "complete";
  }

  if (latestChapter > 0) {
    return "ongoing";
  }

  if (series?.licensed === true) {
    return "licensed";
  }

  return "unlicensed";
}

function getAlternateTitles(series) {
  if (!Array.isArray(series?.associated)) {
    return [];
  }

  return [
    ...new Set(
      series.associated
        .map(item => item?.title?.trim())
        .filter(Boolean)
    )
  ];
}

export async function lookupMangaUpdates(title) {
  const searchResult = await searchSeries(title);

  if (!searchResult?.record?.series_id) {
    return null;
  }

  const series = await getSeriesDetails(
    searchResult.record.series_id
  );

  const originalStatus = series?.status || "";

  return {
    title:
      series?.title ||
      searchResult.record.title ||
      title,

    alternateTitles: getAlternateTitles(series),

    mangaUpdatesId:
      searchResult.record.series_id,

    sourceMatchTitle:
      searchResult.hit_title || "",

    sourceName: "MangaUpdates",

    sourceUrl:
      series?.url ||
      searchResult.record.url ||
      "",

    originalStatus,

    translationStatus:
      determineTranslationStatus(series),

    translatedChapters:
      toNumber(series?.latest_chapter),

    totalChapters:
      parseStatusCount(
        originalStatus,
        "chapters"
      ),

    translatedVolumes: null,

    totalVolumes:
      parseStatusCount(
        originalStatus,
        "volumes"
      ),

    licensedInEnglish:
      series?.licensed === true,

    officialEnglishPublisher:
      getEnglishPublisher(series?.publishers),

    notes:
      series?.completed === true
        ? "MangaUpdates marks this series as completely scanlated."
        : "",

    lastChecked: Date.now()
  };
}
