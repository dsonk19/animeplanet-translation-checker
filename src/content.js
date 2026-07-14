const extensionApi =
  globalThis.browser ?? globalThis.chrome;

const REQUEST_EVENT =
  "ap-translation-checker-request";

const RESPONSE_EVENT =
  "ap-translation-checker-response";

function dispatchResponse(detail) {
  document.dispatchEvent(
    new CustomEvent(
      RESPONSE_EVENT,
      {
        detail: JSON.stringify(detail)
      }
    )
  );
}

document.addEventListener(
  REQUEST_EVENT,
  event => {
    let detail;

    try {
      detail = JSON.parse(event.detail);
    } catch (error) {
      console.error(
        "Anime-Planet Translation Checker received an invalid request:",
        error
      );

      return;
    }

    const {
      requestId,
      message
    } = detail;

    extensionApi.runtime
      .sendMessage(message)
      .then(response => {
        dispatchResponse({
          requestId,
          response
        });
      })
      .catch(error => {
        dispatchResponse({
          requestId,
          error:
            error?.message ||
            "Extension message failed."
        });
      });
  }
);

const mainModuleUrl =
  extensionApi.runtime.getURL("src/main.js");

import(mainModuleUrl).catch(error => {
  console.error(
    "Anime-Planet Translation Checker could not start:",
    error
  );
});
