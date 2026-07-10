const DATABASE_NAME = "animeplanet-translation-checker";
const DATABASE_VERSION = 1;
const MANGA_STORE = "manga";

let databasePromise = null;

function openDatabase() {
  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(MANGA_STORE)) {
        const store = database.createObjectStore(MANGA_STORE, {
          keyPath: "animePlanetUrl"
        });

        store.createIndex("title", "title", {
          unique: false
        });

        store.createIndex("lastChecked", "lastChecked", {
          unique: false
        });

        store.createIndex("translationStatus", "translationStatus", {
          unique: false
        });
      }
    };
  });

  return databasePromise;
}

function useStore(mode, action) {
  return openDatabase().then(
    database =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(MANGA_STORE, mode);
        const store = transaction.objectStore(MANGA_STORE);

        let request;

        try {
          request = action(store);
        } catch (error) {
          reject(error);
          return;
        }

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(request.error);
        };
      })
  );
}

export function getStoredManga(animePlanetUrl) {
  return useStore("readonly", store => store.get(animePlanetUrl));
}

export function saveStoredManga(manga) {
  if (!manga?.animePlanetUrl) {
    throw new Error(
      "A stored manga record must include an animePlanetUrl."
    );
  }

  const record = {
    title: "",
    alternateTitles: [],
    animePlanetUrl: "",
    sourceName: "",
    sourceUrl: "",
    originalStatus: "",
    translationStatus: "unknown",
    translatedChapters: null,
    totalChapters: null,
    translatedVolumes: null,
    totalVolumes: null,
    licensedInEnglish: null,
    officialEnglishPublisher: "",
    notes: "",
    lastChecked: Date.now(),
    ...manga
  };

  return useStore("readwrite", store => store.put(record));
}

export function deleteStoredManga(animePlanetUrl) {
  return useStore("readwrite", store =>
    store.delete(animePlanetUrl)
  );
}

export function getAllStoredManga() {
  return useStore("readonly", store => store.getAll());
}

export function clearStoredManga() {
  return useStore("readwrite", store => store.clear());
}

export function isStoredMangaFresh(
  manga,
  maximumAge = 7 * 24 * 60 * 60 * 1000
) {
  if (!manga?.lastChecked) {
    return false;
  }

  return Date.now() - manga.lastChecked < maximumAge;
}
