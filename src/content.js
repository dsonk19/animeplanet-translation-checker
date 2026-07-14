const extensionApi =
  globalThis.browser ?? globalThis.chrome;

const mainModuleUrl =
  extensionApi.runtime.getURL("src/main.js");

const mangaUpdatesModuleUrl =
  extensionApi.runtime.getURL(
    "src/mangaupdates.js"
  );

import(mangaUpdatesModuleUrl)
  .then(module => {
    module.setMangaUpdatesRequestHandler(
      message =>
        extensionApi.runtime.sendMessage(message)
    );

    return import(mainModuleUrl);
  })
  .catch(error => {
    console.error(
      "Anime-Planet Translation Checker could not start:",
      error
    );
  });
