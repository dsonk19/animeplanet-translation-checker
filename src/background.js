const extensionApi =
  globalThis.browser ?? globalThis.chrome;

const API_BASE_URL =
  "https://api.mangaupdates.com/v1";

const REQUEST_TIMEOUT = 15000;

const MESSAGE_TYPE =
  "animeplanet-mangaupdates-request";

const MESSAGE_PORT_NAME =
  "animeplanet-mangaupdates";

async function fetchMangaUpdates(
  path,
  options = {}
) {
  if (
    typeof path !== "string" ||
    !path.startsWith("/")
  ) {
    throw new Error(
      "Invalid MangaUpdates request path."
    );
  }

  const controller = new AbortController();

  const timeout = globalThis.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT);

  try {
    const response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        method: options.method || "GET",

        headers: {
          Accept: "application/json",

          ...(options.body
            ? {
                "Content-Type": "application/json"
              }
            : {})
        },

        body: options.body
          ? JSON.stringify(options.body)
          : undefined,

        signal: controller.signal
      }
    );

    if (!response.ok) {
      throw new Error(
        `MangaUpdates request failed: ${response.status}`
      );
    }

    return await response.json();
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function handleMangaUpdatesRequest(message) {
  try {
    return {
      ok: true,
      data: await fetchMangaUpdates(
        message.path,
        message.options
      )
    };
  } catch (error) {
    console.error(
      "MangaUpdates background request failed:",
      error
    );

    return {
      ok: false,
      error:
        error?.message ||
        "Unknown MangaUpdates error"
    };
  }
}

extensionApi.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    if (
      message?.type !== MESSAGE_TYPE
    ) {
      return false;
    }

    handleMangaUpdatesRequest(message)
      .then(sendResponse);

    return true;
  }
);

extensionApi.runtime.onConnect.addListener(
  port => {
    if (port.name !== MESSAGE_PORT_NAME) {
      return;
    }

    port.onMessage.addListener(message => {
      if (message?.type !== MESSAGE_TYPE) {
        return;
      }

      handleMangaUpdatesRequest(message)
        .then(response => {
          port.postMessage(response);
        })
        .catch(error => {
          console.error(
            "Could not send MangaUpdates response:",
            error
          );
        });
    });
  }
);
