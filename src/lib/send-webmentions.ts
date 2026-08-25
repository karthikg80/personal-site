import { parseWebmentionCliArgs, sendWebmentions } from './webmentions/send-outbound.js';

await sendWebmentions(parseWebmentionCliArgs(process.argv.slice(2)));
