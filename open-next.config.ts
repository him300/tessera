// The Cloudflare adapter's defaults. Nothing is cached, because every page in
// this record depends on a date that moves and on rows that arrive from D1.
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig();
