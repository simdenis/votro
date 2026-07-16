import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache'

// ISR/SSG pages (revalidate) are cached in R2 (NEXT_INC_CACHE_R2_BUCKET). This
// site has many on-demand-ISR pages (deputati/[id], voturi/[id], legi/[id]),
// so R2's write volume headroom beats KV's daily write cap.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
})
