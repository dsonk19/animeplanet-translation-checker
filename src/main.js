import {
  findMangaLinks,
  findMangaCard,
  getMangaTitle
} from "./animeplanet.js";

import {
  getStoredManga,
  saveStoredManga,
  isStoredMangaFresh
} from "./storage.js";

import {
  attachStatusPanel,
  showStatusError
} from "./ui.js";

import {
  lookupMangaUpdates
} from "./mangaupdates.js";

const PROCESSED_ATTRIBUTE =
  "data-ap-translation-checker-processed";

const MAX_CONCURRENT_LOOKUPS = 3;

let scanScheduled = false;
let activeLookupCount = 0;

const lookupQueue = [];

function runQueuedLookups() {
  while (
    activeLookupCount < MAX_CONCURRENT_LOOKUPS &&
    lookupQueue.length > 0
  ) {
    const {
      task,
      resolve,
      reject
    } = lookupQueue.shift();

    activeLookupCount += 1;

    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => {
        activeLookupCount -= 1;
        runQueuedLookups();
      });
  }
}

function queueLookup(task) {
  return new Promise((resolve, reject) => {
    lookupQueue.push({
      task,
      resolve,
      reject
    });

    runQueuedLookups();
  });
}

function getCanonicalMangaUrl(link) {
  const url = new URL(
    link.href,
    window.location.origin
  );

  url.hash = "";
  url.search = "";

  url.pathname =
    url.pathname.replace(/\/+$/, "");

  return url.href;
}

function createUnknownMangaRecord(link) {
  return {
    title: getMangaTitle(link),

    animePlanetUrl:
      getCanonicalMangaUrl(link),

    translationStatus: "unknown",

    lastChecked: 0
  };
}

function createNotFoundRecord(link) {
  return {
    ...createUnknownMangaRecord(link),

    sourceName: "MangaUpdates",

    notes:
      "No confident MangaUpdates match was found.",

    lastChecked: Date.now()
  };
}

async function processMangaLink(link) {
  const card = findMangaCard(link);

  if (!card) {
    return;
  }

  if (
    card.hasAttribute(PROCESSED_ATTRIBUTE)
  ) {
    return;
  }

  card.setAttribute(
    PROCESSED_ATTRIBUTE,
    "true"
  );

  const panel = attachStatusPanel(card);

  const animePlanetUrl =
    getCanonicalMangaUrl(link);

  const animePlanetTitle =
    getMangaTitle(link);

  let storedManga = null;

  try {
    storedManga =
      await getStoredManga(animePlanetUrl);

    if (storedManga) {
      attachStatusPanel(
        card,
        storedManga
      );

     const hasUsableStatus =
  storedManga.translationStatus &&
  storedManga.translationStatus !== "unknown";

const isFresh =
  hasUsableStatus &&
  isStoredMangaFresh(storedManga);

panel.dataset.needsRefresh =
  String(!isFresh);

if (isFresh) {
  return;
}
    }

    const lookupResult =
      await queueLookup(() =>
        lookupMangaUpdates(
          animePlanetTitle
        )
      );

    if (!lookupResult) {
      /*
       * Keep old information if a previously matched
       * title temporarily cannot be found again.
       */
      if (storedManga) {
        panel.dataset.needsRefresh =
          "true";

        return;
      }

      const notFoundRecord =
        createNotFoundRecord(link);

      await saveStoredManga(
        notFoundRecord
      );

      attachStatusPanel(
        card,
        notFoundRecord
      );

      panel.dataset.needsRefresh =
        "false";

      return;
    }

    const updatedRecord = {
      ...createUnknownMangaRecord(link),
      ...(storedManga || {}),
      ...lookupResult,

      /*
       * Keep the Anime-Planet title as the main stored
       * title and save MangaUpdates' title separately.
       */
      title: animePlanetTitle,

      sourceTitle:
        lookupResult.title || "",

      animePlanetUrl,

      lastChecked:
        lookupResult.lastChecked ||
        Date.now()
    };

    await saveStoredManga(
      updatedRecord
    );

    attachStatusPanel(
      card,
      updatedRecord
    );

    panel.dataset.needsRefresh =
      "false";
  } catch (error) {
    console.error(
      "Anime-Planet Translation Checker:",
      error
    );

    /*
     * If cached information exists, leave it visible
     * rather than replacing it with an error.
     */
    if (storedManga) {
      panel.dataset.needsRefresh =
        "true";

      panel.dataset.refreshError =
        "true";

      return;
    }

    showStatusError(panel);
  }
}

export async function scanAnimePlanetPage(
  root = document
) {
  const links = findMangaLinks(root);

  const uniqueLinks = new Map();

  for (const link of links) {
    const url =
      getCanonicalMangaUrl(link);

    if (!uniqueLinks.has(url)) {
      uniqueLinks.set(url, link);
    }
  }

  await Promise.allSettled(
    [...uniqueLinks.values()].map(
      processMangaLink
    )
  );
}

function schedulePageScan() {
  if (scanScheduled) {
    return;
  }

  scanScheduled = true;

  const runScan = () => {
    scanScheduled = false;
    scanAnimePlanetPage();
  };

  if (
    "requestIdleCallback" in window
  ) {
    window.requestIdleCallback(
      runScan,
      {
        timeout: 1000
      }
    );
  } else {
    window.setTimeout(
      runScan,
      50
    );
  }
}

function watchForPageChanges() {
  const observer =
    new MutationObserver(() => {
      schedulePageScan();
    });

  observer.observe(
    document.body,
    {
      childList: true,
      subtree: true
    }
  );
}

function startTranslationChecker() {
  schedulePageScan();
  watchForPageChanges();
}

if (
  document.readyState === "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    startTranslationChecker,
    {
      once: true
    }
  );
} else {
  startTranslationChecker();
}
