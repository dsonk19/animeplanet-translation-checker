const PANEL_CLASS = "ap-translation-panel";

const STATUS_LABELS = {
  complete: "English: Complete",
  ongoing: "English: In progress",
  stalled: "English: Stalled",
  licensed: "English: Licensed",
  unlicensed: "English: Not licensed",
  unavailable: "English: Unavailable",
  unknown: "English: Unknown"
};

function hasNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function formatProgress(manga) {
  const {
    translatedChapters,
    totalChapters,
    translatedVolumes,
    totalVolumes
  } = manga;

  if (
    hasNumber(translatedChapters) &&
    hasNumber(totalChapters)
  ) {
    return `${translatedChapters}/${totalChapters} chapters translated`;
  }

  if (hasNumber(translatedChapters)) {
    return `${translatedChapters} chapters translated`;
  }

  if (
    hasNumber(translatedVolumes) &&
    hasNumber(totalVolumes)
  ) {
    return `${translatedVolumes}/${totalVolumes} volumes translated`;
  }

  if (hasNumber(translatedVolumes)) {
    return `${translatedVolumes} volumes translated`;
  }

  if (manga.licensedInEnglish === true) {
    return manga.officialEnglishPublisher
      ? `Publisher: ${manga.officialEnglishPublisher}`
      : "Official English release found";
  }

  if (manga.licensedInEnglish === false) {
    return "No official English release found";
  }

  return "Translation details not found yet";
}

export function createStatusPanel() {
  const panel = document.createElement("div");
  panel.className = PANEL_CLASS;

  const statusLine = document.createElement("div");
  statusLine.className = `${PANEL_CLASS}__status`;

  const detailLine = document.createElement("div");
  detailLine.className = `${PANEL_CLASS}__details`;

  panel.append(statusLine, detailLine);

  return panel;
}

export function updateStatusPanel(panel, manga = {}) {
  const statusLine = panel.querySelector(
    `.${PANEL_CLASS}__status`
  );

  const detailLine = panel.querySelector(
    `.${PANEL_CLASS}__details`
  );

  const translationStatus =
    manga.translationStatus || "unknown";

  statusLine.textContent =
    STATUS_LABELS[translationStatus] ||
    STATUS_LABELS.unknown;

  detailLine.textContent = formatProgress(manga);

  panel.dataset.status = translationStatus;

  if (manga.sourceUrl) {
    panel.title = manga.sourceName
      ? `Source: ${manga.sourceName}`
      : "Open source information";

    panel.dataset.sourceUrl = manga.sourceUrl;
  } else {
    panel.removeAttribute("title");
    delete panel.dataset.sourceUrl;
  }
}

export function showStatusLoading(panel) {
  const statusLine = panel.querySelector(
    `.${PANEL_CLASS}__status`
  );

  const detailLine = panel.querySelector(
    `.${PANEL_CLASS}__details`
  );

  statusLine.textContent = "Checking English status…";
  detailLine.textContent = "Looking for saved information";
  panel.dataset.status = "loading";
}

export function showStatusError(panel) {
  const statusLine = panel.querySelector(
    `.${PANEL_CLASS}__status`
  );

  const detailLine = panel.querySelector(
    `.${PANEL_CLASS}__details`
  );

  statusLine.textContent = "English status unavailable";
  detailLine.textContent = "Could not check this title";
  panel.dataset.status = "error";
}

export function attachStatusPanel(card, manga = null) {
  let panel = card.querySelector(`.${PANEL_CLASS}`);

  if (!panel) {
    panel = createStatusPanel();
    card.append(panel);
  }

  if (manga) {
    updateStatusPanel(panel, manga);
  } else {
    showStatusLoading(panel);
  }

  return panel;
}
