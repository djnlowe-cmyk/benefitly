import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from './src/lib/sentryScrubber';

const dsn = process.env.SENTRY_DSN || '';

Sentry.init({
  dsn,
  enabled: dsn.length > 0,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0,
  beforeSend(event) {
    scrubEvent(event as unknown as Parameters<typeof scrubEvent>[0]);
    return event;
  },
});
