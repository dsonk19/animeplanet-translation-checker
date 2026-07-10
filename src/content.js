const extensionApi =
  globalThis.browser ?? globalThis.chrome;

const mainModuleUrl =
  extensionApi.runtime.getURL("src/main.js");

import(mainModuleUrl).catch(error => {
  console.error(
    "Anime-Planet Translation Checker could not start:",
    error
  );
});
