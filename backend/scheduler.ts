import { runScrapeAndIndex } from './scraper';
import { esClient } from './server';
import { clearApiCache } from './routes/api';

export function startScraperScheduler() {
  console.log('⏰ [Scheduler] Initializing Scraper Background Scheduler...');

  const runJob = async () => {
    try {
      const now = new Date();
      // Parse hour and minute in Asia/Kolkata (IST) timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
        timeZone: 'Asia/Kolkata'
      });
      const parts = formatter.formatToParts(now);
      const hourPart = parts.find(p => p.type === 'hour');
      const minutePart = parts.find(p => p.type === 'minute');
      
      const hour = hourPart ? parseInt(hourPart.value, 10) : now.getHours();
      const minute = minutePart ? parseInt(minutePart.value, 10) : now.getMinutes();

      const timeInMinutes = hour * 60 + minute;
      const START_MINUTES = 22 * 60 + 30; // 10:30 PM (22:30)
      const END_MINUTES = 9 * 60;        // 9:00 AM (09:00)

      const isNightWindow = timeInMinutes >= START_MINUTES || timeInMinutes < END_MINUTES;

      if (!isNightWindow) {
        console.log(`[Scheduler] Current time is ${hour}:${minute.toString().padStart(2, '0')} IST. Skipping background scraper run during IST daytime (9:00 AM - 10:30 PM IST).`);
        return;
      }

      console.log(`[Scheduler] Triggering background scraper run at time ${hour}:${minute.toString().padStart(2, '0')} IST...`);
      const result = await runScrapeAndIndex(esClient);
      if (result.success) {
        console.log(`[Scheduler] Scraper finished successfully. ${result.message} Clearing cache.`);
        clearApiCache();
      } else {
        console.error(`[Scheduler] Scraper failed: ${result.message}`);
      }
    } catch (err: any) {
      console.error(`[Scheduler] Error in scraper job:`, err);
    }
  };

  // Run once on server startup (only if not during night hours)
  runJob();

  // Run every 3 hours
  setInterval(runJob, 3 * 60 * 60 * 1000);
}
