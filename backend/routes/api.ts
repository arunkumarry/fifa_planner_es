import express from 'express';
import { LRUCache } from 'lru-cache';
import { getHandleLocalElasticSearch, esClient } from '../server';
import { runScrapeAndIndex } from '../scraper';

const router = express.Router();

// 5-minute cache, up to 100 items
const cache = new LRUCache<string, any>({
  max: 100,
  ttl: 1000 * 60 * 5,
});

export function clearApiCache() {
  cache.clear();
  console.log('⚡ API Cache cleared successfully.');
}

async function getFromCacheOrFetch(key: string, fetchFn: () => Promise<any>) {
  if (cache.has(key)) {
    console.log(`[CACHE HIT] ${key}`);
    return cache.get(key);
  }
  console.log(`[CACHE MISS] Fetching ${key}`);
  const data = await fetchFn();
  cache.set(key, data);
  return data;
}

router.get('/matches', async (req, res) => {
  try {
    const data = await getFromCacheOrFetch('all_matches', async () => {
      const response = await esClient.search({
        index: 'fifa_matches',
        body: { 
          query: { match_all: {} }, 
          size: 100,
          sort: [{ date: { order: 'asc' } }]
        }
      });
      return response.hits.hits.map((hit: any) => hit._source);
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stadiums', async (req, res) => {
  try {
    const data = await getFromCacheOrFetch('all_stadiums', async () => {
      const response = await esClient.search({
        index: 'fifa_stadiums',
        body: { query: { match_all: {} }, size: 100 }
      });
      return response.hits.hits.map((hit: any) => {
        const src = hit._source;
        return {
          ...src,
          latitude: src.location?.lat,
          longitude: src.location?.lon
        };
      });
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/weather/:city', async (req, res) => {
  try {
    const city = req.params.city;
    const data = await getFromCacheOrFetch(`weather_${city}`, async () => {
      const response = await esClient.search({
        index: 'weather_history',
        body: {
          query: {
            match: { city: city }
          },
          size: 12
        }
      });
      return response.hits.hits.map((hit: any) => hit._source);
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/accommodations/:stadiumId', async (req, res) => {
  try {
    const stadiumId = req.params.stadiumId;
    const data = await getFromCacheOrFetch(`accommodations_${stadiumId}`, async () => {
      const localHandler = getHandleLocalElasticSearch();
      const mcpResult = await localHandler('find_nearby_accommodations', { stadium_id: stadiumId });
      let outputData: any = mcpResult;
      if (Array.isArray(mcpResult) && mcpResult.length > 0 && mcpResult[0].type === 'text') {
        try {
          outputData = JSON.parse(mcpResult[0].text);
        } catch {
          outputData = mcpResult[0].text;
        }
      }
      const accList = outputData.accommodations || outputData;
      return accList.map((acc: any) => {
        if (typeof acc.location === 'string' && acc.location.startsWith('POINT')) {
          const match = acc.location.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
          if (match) {
            acc.longitude = parseFloat(match[1]);
            acc.latitude = parseFloat(match[2]);
          }
        }
        return acc;
      });
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/hospitals/:stadiumId', async (req, res) => {
  try {
    const stadiumId = req.params.stadiumId;
    const data = await getFromCacheOrFetch(`hospitals_${stadiumId}`, async () => {
      const localHandler = getHandleLocalElasticSearch();
      const mcpResult = await localHandler('find_nearby_hospitals', { stadium_id: stadiumId });
      let outputData: any = mcpResult;
      if (Array.isArray(mcpResult) && mcpResult.length > 0 && mcpResult[0].type === 'text') {
        try {
          outputData = JSON.parse(mcpResult[0].text);
        } catch {
          outputData = mcpResult[0].text;
        }
      }
      const hospList = outputData.hospitals || outputData;
      return hospList.map((h: any) => {
        if (typeof h.location === 'string' && h.location.startsWith('POINT')) {
          const match = h.location.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
          if (match) {
            h.longitude = parseFloat(match[1]);
            h.latitude = parseFloat(match[2]);
          }
        }
        return h;
      });
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/teams/stats', async (req, res) => {
  try {
    const data = await getFromCacheOrFetch('team_stats', async () => {
      const response = await esClient.search({
        index: 'fifa_team_stats_history',
        body: { query: { match_all: {} }, size: 1000 }
      });
      
      const statsMap: Record<string, any> = {};
      response.hits.hits.forEach((hit: any) => {
        const doc = hit._source;
        // Keep the most recent stats for each team
        if (!statsMap[doc.team] || statsMap[doc.team].version < doc.version) {
          statsMap[doc.team] = doc;
        }
      });
      return statsMap;
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/standings/:group', async (req, res) => {
  try {
    let group = req.params.group.trim();
    if (group.length === 1) {
      group = `Group ${group.toUpperCase()}`;
    } else if (group.toLowerCase().startsWith('group')) {
      const parts = group.split(/\s+/);
      const letter = parts[parts.length - 1].toUpperCase();
      group = `Group ${letter}`;
    }
    
    const data = await getFromCacheOrFetch(`standings_${group}`, async () => {
      const response = await esClient.search({
        index: 'fifa_standings',
        body: {
          query: {
            term: { group: group }
          },
          sort: [{ pos: { order: 'asc' } }],
          size: 10
        }
      });
      return response.hits.hits.map((hit: any) => hit._source);
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/standings', async (req, res) => {
  try {
    const data = await getFromCacheOrFetch('all_standings', async () => {
      const response = await esClient.search({
        index: 'fifa_standings',
        body: {
          query: { match_all: {} },
          sort: [
            { group: { order: 'asc' } },
            { pos: { order: 'asc' } }
          ],
          size: 100
        }
      });
      return response.hits.hits.map((hit: any) => hit._source);
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/scrape-and-index', async (req, res) => {
  try {
    const authHeader = req.headers['x-admin-token'];
    const expectedToken = process.env.ADMIN_TOKEN || 'local-fallback-token';

    if (authHeader !== expectedToken) {
      res.status(401).json({ error: 'Unauthorized: Invalid admin token.' });
      return;
    }

    console.log('[API Admin] Triggering manual scrape-and-index request...');
    const result = await runScrapeAndIndex(esClient);
    if (result.success) {
      clearApiCache();
      res.json({ message: 'Scraping and re-indexing completed successfully.', details: result.message });
    } else if (result.message === 'Scraping job already in progress.') {
      res.status(409).json({ error: 'Conflict', details: result.message });
    } else {
      res.status(500).json({ error: 'Scraper failed', details: result.message });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
