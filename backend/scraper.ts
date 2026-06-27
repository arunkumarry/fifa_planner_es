import { Client as EsClient } from '@elastic/elasticsearch';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import * as cheerio from 'cheerio';

// Colloquial/Standard names mapped to official names in data/teams.csv
const TEAM_NAME_MAPPINGS: Record<string, string> = {
  "bosnia-herzegovina": "BiH",
  "bosnia & herzegovina": "BiH",
  "bosnia and herzegovina": "BiH",
  "united states": "USA",
  "turkey": "Türkiye",
  "curacao": "Curaçao",
  "ivory coast": "Côte d'Ivoire",
  "iran": "IR Iran",
  "cape verde": "Cabo Verde",
  "congo dr": "DR Congo",
  "dr congo": "DR Congo",
};

export function normalizeTeamName(name: string): string {
  const clean = name.trim();
  const lower = clean.toLowerCase();
  if (TEAM_NAME_MAPPINGS[lower]) {
    return TEAM_NAME_MAPPINGS[lower];
  }
  // Remove qualification/elimination markers from Sporting News (e.g. "Mexico - Q" -> "Mexico")
  const cleaned = clean.replace(/\s*-\s*[QE]/g, '').replace(/\s*-\s*Qualified.*/gi, '').trim();
  const cleanedLower = cleaned.toLowerCase();
  if (TEAM_NAME_MAPPINGS[cleanedLower]) {
    return TEAM_NAME_MAPPINGS[cleanedLower];
  }
  return cleaned;
}

// Helper to parse CSV using csv-parser
function parseCsvFile<T>(filePath: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = [];
    if (!fs.existsSync(filePath)) {
      resolve([]);
      return;
    }
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

// Helper to format field for CSV (escapes commas and quotes)
function formatCsvField(val: any): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

interface ParsedMatch {
  awayTeam: string;
  homeTeam: string;
  scoreOrVs: string;
  status: 'completed' | 'scheduled';
}

interface ParsedStanding {
  group: string;
  pos: string;
  team: string;
  pts: number;
  gp: number;
  w: number;
  l: number;
  d: number;
  gf: number;
  ga: number;
  gd: number;
}

async function fetchHtml(url: string, fallbackPath: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    console.log(`[Scraper] Fetching URL: ${url}`);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const text = await res.text();
      if (text && text.trim().length > 0) {
        return text;
      }
    }
    console.warn(`[Scraper] Fetch returned non-OK status: ${res.status}. Falling back to local archive.`);
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.warn(`[Scraper] Fetch to ${url} timed out after 10 seconds. Falling back to local archive.`);
    } else {
      console.warn(`[Scraper] Fetch failed with error: ${err.message}. Falling back to local archive.`);
    }
  }

  if (fs.existsSync(fallbackPath)) {
    console.log(`[Scraper] Loading archive file: ${fallbackPath}`);
    let content = fs.readFileSync(fallbackPath, 'utf8');
    const separatorIdx = content.indexOf('---');
    if (separatorIdx !== -1) {
      content = content.substring(separatorIdx + 3).trim();
    }
    return content;
  }
  throw new Error(`Failed to load content from URL and archive file ${fallbackPath} does not exist.`);
}


function parseEspnMatches(html: string): ParsedMatch[] {
  const $ = cheerio.load(html);
  $('script, style').remove();
  const list: ParsedMatch[] = [];

  $('table').each((_, tableEl) => {
    const headers: string[] = [];
    $(tableEl).find('thead th').each((__, thEl) => {
      headers.push($(thEl).text().trim().toLowerCase());
    });

    const isCompleted = headers.includes('result');
    const isScheduled = headers.includes('time');

    if (!isCompleted && !isScheduled) return;

    $(tableEl).find('tbody tr.Table__TR').each((___, trEl) => {
      const row = $(trEl);
      const awayTeam = row.find('td.events__col .Table__Team').text().trim();
      const localCol = row.find('td.colspan__col');
      const homeTeam = localCol.find('.Table__Team').text().trim();
      const scoreOrVs = localCol.find('a.at').text().trim().replace(/\s+/g, ' ');

      if (!awayTeam || !homeTeam) return;

      list.push({
        awayTeam: normalizeTeamName(awayTeam),
        homeTeam: normalizeTeamName(homeTeam),
        scoreOrVs,
        status: isCompleted ? 'completed' : 'scheduled'
      });
    });
  });

  return list;
}

let isScrapingInProgress = false;

export async function runScrapeAndIndex(esClient: EsClient): Promise<{ success: boolean; message: string }> {
  if (isScrapingInProgress) {
    console.log('⚠️ [Scraper] A scraping job is already in progress. Skipping concurrency execution.');
    return { success: false, message: 'Scraping job already in progress.' };
  }
  isScrapingInProgress = true;

  console.log('🏁 [Scraper] Starting background scraping and re-indexing job...');

  try {
    const dataDir = path.join(__dirname, '../data');
    
    // 1. Fetch and parse Sporting News Standings Page
    console.log('📥 [Scraper] Fetching Sporting News standings page...');
    const standingsHtml = await fetchHtml(
      'https://www.sportingnews.com/in/football/news/world-cup-2026-standings-table-live-updated-groups/8c2619077197f0ec1b77d9fb',
      path.join(__dirname, 'archive/sportingnews.html')
    );
    const $standings = cheerio.load(standingsHtml);
    $standings('script, style').remove();

    const scrapedStandings: ParsedStanding[] = [];

    $standings('h3').each((_, h3El) => {
      const title = $standings(h3El).text().trim();
      if (!title.toLowerCase().includes('group') || !title.toLowerCase().includes('table')) {
        return;
      }

      const groupMatch = title.match(/Group\s+([A-L])/i);
      if (!groupMatch) return;
      const groupName = `Group ${groupMatch[1].toUpperCase()}`;

      const table = $standings(h3El).nextAll('table').first();
      if (table.length === 0) return;

      table.find('tbody tr').each((rowIdx, trEl) => {
        const cells = $standings(trEl).find('td, th');
        const firstCellText = $standings(cells[0]).text().trim().toLowerCase();
        if (firstCellText === 'pos' || firstCellText === 'team') {
          return; // Skip header row
        }

        if (cells.length < 9) return;

        let pos = '';
        let teamNameRaw = '';
        let pts = 0, gp = 0, w = 0, l = 0, d = 0, gf = 0, ga = 0, gd = 0;

        if (cells.length >= 10) {
          // 10-column format: Pos, Team, PTS, GP, W, L, D, GF, GA, GD
          pos = $standings(cells[0]).text().trim().replace('.', '');
          teamNameRaw = $standings(cells[1]).text().trim();
          pts = parseInt($standings(cells[2]).text().trim(), 10) || 0;
          gp = parseInt($standings(cells[3]).text().trim(), 10) || 0;
          w = parseInt($standings(cells[4]).text().trim(), 10) || 0;
          l = parseInt($standings(cells[5]).text().trim(), 10) || 0;
          d = parseInt($standings(cells[6]).text().trim(), 10) || 0;
          gf = parseInt($standings(cells[7]).text().trim(), 10) || 0;
          ga = parseInt($standings(cells[8]).text().trim(), 10) || 0;
          gd = parseInt($standings(cells[9]).text().trim().replace('+', ''), 10) || 0;
        } else {
          // 9-column format: Team (with pos prefix), PTS, GP, W, L, D, GF, GA, GD
          teamNameRaw = $standings(cells[0]).text().trim();
          const posMatch = teamNameRaw.match(/^(\d+)\.\s*(.*)/);
          if (posMatch) {
            pos = posMatch[1];
            teamNameRaw = posMatch[2];
          }
          pts = parseInt($standings(cells[1]).text().trim(), 10) || 0;
          gp = parseInt($standings(cells[2]).text().trim(), 10) || 0;
          w = parseInt($standings(cells[3]).text().trim(), 10) || 0;
          l = parseInt($standings(cells[4]).text().trim(), 10) || 0;
          d = parseInt($standings(cells[5]).text().trim(), 10) || 0;
          gf = parseInt($standings(cells[6]).text().trim(), 10) || 0;
          ga = parseInt($standings(cells[7]).text().trim(), 10) || 0;
          gd = parseInt($standings(cells[8]).text().trim().replace('+', ''), 10) || 0;
        }

        const normalizedTeam = normalizeTeamName(teamNameRaw);

        scrapedStandings.push({
          group: groupName,
          pos,
          team: normalizedTeam,
          pts,
          gp,
          w,
          l,
          d,
          gf,
          ga,
          gd
        });
      });
    });

    console.log(`📊 [Scraper] Scraped ${scrapedStandings.length} standings records.`);

    // 2. Fetch and parse ESPN Fixtures Page (with live + archive merge logic)
    console.log('📥 [Scraper] Fetching ESPN fixtures page...');
    let scrapedMatches: ParsedMatch[] = [];
    try {
      const fixturesHtml = await fetchHtml(
        'https://www.espn.in/football/fixtures/_/league/fifa.world',
        path.join(__dirname, 'archive/espn.html')
      );
      scrapedMatches = parseEspnMatches(fixturesHtml);
    } catch (err: any) {
      console.warn(`[Scraper] Failed to fetch or parse live ESPN fixtures. Falling back to local archive.`);
    }

    // Always merge matches from the archive fallback to ensure we don't miss any matches that rotated off the live page
    const archivePath = path.join(__dirname, 'archive/espn.html');
    if (fs.existsSync(archivePath)) {
      console.log(`[Scraper] Merging matches from archive: ${archivePath}`);
      let archiveContent = fs.readFileSync(archivePath, 'utf8');
      const separatorIdx = archiveContent.indexOf('---');
      if (separatorIdx !== -1) {
        archiveContent = archiveContent.substring(separatorIdx + 3).trim();
      }
      const archiveMatches = parseEspnMatches(archiveContent);
      
      // Merge: if a match from archive is completed, and we don't have it as completed in scrapedMatches, add/update it!
      for (const archMatch of archiveMatches) {
        const existingIdx = scrapedMatches.findIndex(m => 
          (m.awayTeam === archMatch.awayTeam && m.homeTeam === archMatch.homeTeam) ||
          (m.awayTeam === archMatch.homeTeam && m.homeTeam === archMatch.awayTeam)
        );
        if (existingIdx === -1) {
          scrapedMatches.push(archMatch);
        } else {
          // If the archive match is completed, but the scraped one is scheduled, overwrite it with completed!
          if (archMatch.status === 'completed' && scrapedMatches[existingIdx].status === 'scheduled') {
            scrapedMatches[existingIdx] = archMatch;
          }
        }
      }
    }

    console.log(`⚽ [Scraper] Loaded total of ${scrapedMatches.length} match fixture records (merged with archive).`);

    // 3. Update data/fifa_standings.csv
    if (scrapedStandings.length > 0) {
      console.log('💾 [Scraper] Updating local standings CSV...');
      const standingsHeader = "group,pos,team,pts,gp,w,l,d,gf,ga,gd\n";
      const standingsRows = scrapedStandings.map(s => {
        const gdStr = s.gd > 0 ? `+${s.gd}` : `${s.gd}`;
        return `${s.group},${s.pos},"${s.team}",${s.pts},${s.gp},${s.w},${s.l},${s.d},${s.gf},${s.ga},${gdStr}`;
      }).join('\n');
      
      fs.writeFileSync(path.join(dataDir, 'fifa_standings.csv'), standingsHeader + standingsRows);
      console.log('✅ [Scraper] Saved data/fifa_standings.csv');
    }

    // 4. Update data/fifa_matches_complete.csv
    console.log('💾 [Scraper] Loading and updating local matches CSV...');
    const completeMatchesFile = path.join(dataDir, 'fifa_matches_complete.csv');
    const existingMatches = await parseCsvFile<any>(completeMatchesFile);

    if (existingMatches.length === 0) {
      throw new Error('No existing matches found in data/fifa_matches_complete.csv to update.');
    }

    let updatedCount = 0;

    for (const scraped of scrapedMatches) {
      if (scraped.status !== 'completed') continue;

      // Parse score X - Y (where awayTeam score is X, homeTeam score is Y)
      const scoreParts = scraped.scoreOrVs.split('-');
      if (scoreParts.length !== 2) continue;

      const awayGoals = parseInt(scoreParts[0].trim(), 10);
      const homeGoals = parseInt(scoreParts[1].trim(), 10);
      if (isNaN(awayGoals) || isNaN(homeGoals)) continue;

      // Find matching scheduled match in our CSV
      const matchedIdx = existingMatches.findIndex(m => {
        const t1Normalized = normalizeTeamName(m.team_1);
        const t2Normalized = normalizeTeamName(m.team_2);
        return (t1Normalized === scraped.awayTeam && t2Normalized === scraped.homeTeam) ||
               (t1Normalized === scraped.homeTeam && t2Normalized === scraped.awayTeam);
      });

      if (matchedIdx !== -1) {
        const match = existingMatches[matchedIdx];
        
        // Only update if it is not already completed
        if (match.status !== 'completed') {
          const t1Normalized = normalizeTeamName(match.team_1);
          
          let t1Goals = 0;
          let t2Goals = 0;
          let winnerName = 'Draw';

          if (t1Normalized === scraped.awayTeam) {
            t1Goals = awayGoals;
            t2Goals = homeGoals;
          } else {
            t1Goals = homeGoals;
            t2Goals = awayGoals;
          }

          if (t1Goals > t2Goals) {
            winnerName = match.team_1;
          } else if (t2Goals > t1Goals) {
            winnerName = match.team_2;
          }

          const scoreStr = `${t1Goals}-${t2Goals}`;

          let summaryStr = '';
          if (winnerName === 'Draw') {
            summaryStr = `A hard-fought draw ending ${scoreStr} between ${match.team_1} and ${match.team_2}.`;
          } else {
            const loserName = winnerName === match.team_1 ? match.team_2 : match.team_1;
            summaryStr = `${winnerName} secured a decisive victory over ${loserName} with a final score of ${scoreStr}.`;
          }

          match.status = 'completed';
          match.score = scoreStr;
          match.winner = winnerName;
          match.summary = summaryStr;

          updatedCount++;
          console.log(`✏️ [Scraper] Updated match: ${match.team_1} vs ${match.team_2} -> ${scoreStr}`);
        }
      }
    }

    console.log(`📝 [Scraper] Updated ${updatedCount} matches to completed status.`);

    if (updatedCount > 0) {
      // Save data/fifa_matches_complete.csv
      const completeMatchesHeader = "match_id,date,date_int,kickoff_at,team_1,team_2,teams_combined,stage,stadium_id,stadium_name,city,stadium_capacity,stadium_location,month,month_num,day,avg_temp_f,temp_category,weather_conditions,precipitation_chance,rain_risk,match_display,venue_display,weather_display,status,score,winner,summary\n";
      const completeMatchesFields = ["match_id","date","date_int","kickoff_at","team_1","team_2","teams_combined","stage","stadium_id","stadium_name","city","stadium_capacity","stadium_location","month","month_num","day","avg_temp_f","temp_category","weather_conditions","precipitation_chance","rain_risk","match_display","venue_display","weather_display","status","score","winner","summary"];
      
      const completeMatchesRows = existingMatches.map(m => 
        completeMatchesFields.map(f => formatCsvField(m[f])).join(',')
      ).join('\n');

      fs.writeFileSync(completeMatchesFile, completeMatchesHeader + completeMatchesRows);
      console.log('✅ [Scraper] Saved data/fifa_matches_complete.csv');

      // 5. Generate and save data/fifa_matches.csv
      console.log('💾 [Scraper] Re-generating data/fifa_matches.csv...');
      const subsetHeader = "match_id,date,date_int,kickoff_at,team_1,team_2,teams_combined,stadium_id,stadium,city,stadium_location,stage,match_display,month,month_num,status,winner,score,summary\n";
      const subsetRows = existingMatches.map(r => {
        const row = [
          r.match_id, r.date, r.date_int, r.kickoff_at, r.team_1, r.team_2, r.teams_combined,
          r.stadium_id, r.stadium_name, r.city, r.stadium_location, r.stage, r.match_display, r.month, r.month_num,
          r.status || 'scheduled', r.winner || '', r.score || '', `"${(r.summary || '').replace(/"/g, '""')}"`
        ];
        return row.join(',');
      }).join('\n');

      fs.writeFileSync(path.join(dataDir, 'fifa_matches.csv'), subsetHeader + subsetRows);
      console.log('✅ [Scraper] Saved data/fifa_matches.csv');
    }

    // 6. Ingest Standings into Elasticsearch
    if (scrapedStandings.length > 0) {
      console.log('🏆 [Elasticsearch] Re-indexing standings...');
      const standingsIndex = 'fifa_standings';
      if (await esClient.indices.exists({ index: standingsIndex })) {
        await esClient.indices.delete({ index: standingsIndex });
      }

      await esClient.indices.create({
        index: standingsIndex,
        body: {
          mappings: {
            properties: {
              group: { type: 'keyword' },
              pos: { type: 'integer' },
              team: { type: 'keyword' },
              pts: { type: 'integer' },
              gp: { type: 'integer' },
              w: { type: 'integer' },
              l: { type: 'integer' },
              d: { type: 'integer' },
              gf: { type: 'integer' },
              ga: { type: 'integer' },
              gd: { type: 'integer' }
            }
          }
        }
      });

      const standingsOps = scrapedStandings.flatMap(s => {
        const docId = `${s.group.toLowerCase().replace(/\s+/g, '_')}_${s.team.toLowerCase().replace(/\s+/g, '_')}`;
        return [
          { index: { _index: standingsIndex, _id: docId } },
          s
        ];
      });

      if (standingsOps.length > 0) {
        await esClient.bulk({ refresh: true, operations: standingsOps });
        console.log(`✅ [Elasticsearch] Loaded ${scrapedStandings.length} standings successfully.`);
      }
    }

    // 7. Ingest Matches into Elasticsearch
    if (updatedCount > 0) {
      console.log('⚽ [Elasticsearch] Re-indexing matches...');
      const matchesIndex = 'fifa_matches';
      if (await esClient.indices.exists({ index: matchesIndex })) {
        await esClient.indices.delete({ index: matchesIndex });
      }

      await esClient.indices.create({
        index: matchesIndex,
        body: {
          mappings: {
            properties: {
              match_id: { type: 'keyword' },
              date: { type: 'date' },
              date_int: { type: 'integer' },
              kickoff_at: { type: 'keyword' },
              team_1: { type: 'keyword' },
              team_2: { type: 'keyword' },
              teams_combined: { type: 'text' },
              stadium_id: { type: 'keyword' },
              stadium: { type: 'text' },
              city: { type: 'keyword' },
              stadium_location: { type: 'geo_point' },
              stage: { type: 'keyword' },
              match_display: { type: 'text' },
              month: { type: 'keyword' },
              month_num: { type: 'integer' },
              status: { type: 'keyword' },
              winner: { type: 'keyword' },
              score: { type: 'keyword' },
              summary: { type: 'text' }
            }
          }
        }
      });

      const matchesOps = existingMatches.flatMap(r => [
        { index: { _index: matchesIndex, _id: r.match_id } },
        {
          match_id: r.match_id,
          date: r.date,
          date_int: parseInt(r.date_int, 10),
          kickoff_at: r.kickoff_at,
          team_1: r.team_1,
          team_2: r.team_2,
          teams_combined: r.teams_combined,
          stadium_id: r.stadium_id,
          stadium: r.stadium_name.replace(/"/g, ''),
          city: r.city.replace(/"/g, ''),
          stadium_location: r.stadium_location.replace(/"/g, ''),
          stage: r.stage,
          match_display: r.match_display.replace(/"/g, ''),
          month: r.month,
          month_num: parseInt(r.month_num, 10),
          status: r.status || 'scheduled',
          winner: r.winner || '',
          score: r.score || '',
          summary: r.summary || ''
        }
      ]);

      if (matchesOps.length > 0) {
        await esClient.bulk({ refresh: true, operations: matchesOps });
        console.log(`✅ [Elasticsearch] Re-indexed all matches successfully.`);
      }
    }

    console.log('🎉 [Scraper] Scraping and indexing completed successfully!');
    return { success: true, message: `Scraped successfully. Updated ${updatedCount} matches.` };

  } catch (error: any) {
    console.error('💥 [Scraper] Critical Scraper Error:', error);
    return { success: false, message: error.message };
  } finally {
    isScrapingInProgress = false;
  }
}
