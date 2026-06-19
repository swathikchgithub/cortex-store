// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://c0e34b8968e6787f356e49162c0da40b@o4511593792995328.ingest.us.sentry.io/4511593814163456",

  tracesSampleRate: 0.1,
  enableLogs: true,
});
