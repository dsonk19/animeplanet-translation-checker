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

const PROCESSED_ATTRIBUTE =
  "data-ap-translation-checker-processed";

let scanScheduled = false;

function getCanonicalMangaUrl(link) {
  const url = new URL(link.href, window.location.origin);

  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "");

  return url.href;
}

function createUnknownMangaRecord(link) {
  return {
    title: getMangaTitle(link),
    animePlanetUrl: getCanonicalMangaUrl(link),
    translationStatus: "unknown",

    /*
     * Zero means this title has been discovered but has not
     * actually been checked by a translation source yet.
     */
    lastChecked: 0
  };
}

async function processMangaLink(link) {
  const card = findMangaCard(link);

  if (!card) {
    return;
  }

  if (card.hasAttribute(PROCESSED_ATTRIBUTE)) {
    return;
  }

  card.setAttribute(PROCESSED_ATTRIBUTE, "true");

  const panel = attachStatusPanel(card);
  const animePlanetUrl = getCanonicalMangaUrl(link);

  try {
    const storedManga =
      await getStoredManga(animePlanetUrl);

    if (storedManga) {
      attachStatusPanel(card, storedManga);

      panel.dataset.needsRefresh = String(
        !isStoredMangaFresh(storedManga)
      );

      return;
    }

    const newRecord = createUnknownMangaRecord(link);

    await saveStoredManga(newRecord);

    attachStatusPanel(card, newRecord);
    panel.dataset.needsRefresh = "true";
  } catch (error) {
    console.error(
      "Anime-Planet Translation Checker:",
      error
    );

    showStatusError(panel);
  }
}

export async function scanAnimePlanetPage(
  root = document
) {
  const links = findMangaLinks(root);
  const uniqueLinks = new Map();

  for (const link of links) {
    const url = getCanonicalMangaUrl(link);

    if (!uniqueLinks.has(url)) {
      uniqueLinks.set(url, link);
    }
  }

  await Promise.allSettled(
    [...uniqueLinks.values()].map(processMangaLink)
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

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(runScan, {
      timeout: 1000
    });
  } else {
    window.setTimeout(runScan, 50);
  }
}

function watchForPageChanges() {
  const observer = new MutationObserver(() => {
    schedulePageScan();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function startTranslationChecker() {
  schedulePageScan();
  watchForPageChanges();
}

if (document.readyState === "loading") {
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
