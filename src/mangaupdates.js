let requestHandler = null;

export function setMangaUpdatesRequestHandler(
  handler
) {
  if (typeof handler !== "function") {
    throw new TypeError(
      "The MangaUpdates request handler must be a function."
    );
  }

  requestHandler = handler;
}

function sendRuntimeMessage(message) {
  if (!requestHandler) {
    return Promise.reject(
      new Error(
        "The MangaUpdates request bridge is not ready."
      )
    );
  }

  return Promise.resolve()
    .then(() => requestHandler(message));
}

async function fetchJson(path, options = {}) {
  const response = await sendRuntimeMessage({
    type: "animeplanet-mangaupdates-request",
    path,
    options: {
      method: options.method || "GET",
      body: options.body
    }
  });

  if (!response?.ok) {
    throw new Error(
      response?.error ||
      "MangaUpdates request failed."
    );
  }

  return response.data;
}

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
  const candidateWords =
    new Set(candidate.split(" "));

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
      ...getCandidateTitles(result).map(
        candidate =>
          getTitleScore(title, candidate)
      ),
      0
    );

    if (score > bestScore) {
      bestResult = result;
      bestScore = score;
    }
  }

  return bestScore >= 40
    ? bestResult
    : null;
}

async function searchSeries(title) {
  const response = await fetchJson(
    "/series/search",
    {
      method: "POST",
      body: {
        search: title,
        stype: "title"
      }
    }
  );

  const results = Array.isArray(response?.results)
    ? response.results
    : [];

  return chooseBestSearchResult(results, title);
}

async function getSeriesDetails(seriesId) {
  return fetchJson(
    `/series/${encodeURIComponent(seriesId)}`
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

  const match =
    String(status).match(expression);

  return match
    ? toNumber(match[1])
    : null;
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
  const searchResult =
    await searchSeries(title);

  const seriesId =
    searchResult?.record?.series_id;

  if (!seriesId) {
    return null;
  }

  const series =
    await getSeriesDetails(seriesId);

  const originalStatus =
    series?.status || "";

  return {
    title:
      series?.title ||
      searchResult.record.title ||
      title,

    alternateTitles:
      getAlternateTitles(series),

    mangaUpdatesId: seriesId,

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
      getEnglishPublisher(
        series?.publishers
      ),

    notes:
      series?.completed === true
        ? "MangaUpdates marks this series as completely scanlated."
        : "",

    lastChecked: Date.now()
  };
}
