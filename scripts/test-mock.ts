import { MOCK_RACES, MOCK_RACES_FROM_SCRAPERS, MOCK_MY_RACES, MOCK_PROFILE, MOCK_PRS } from '../lib/mock/data';

console.log('=== MOCK DATA SUMMARY ===');
console.log('MOCK_RACES:', MOCK_RACES.length);
console.log('MOCK_RACES_FROM_SCRAPERS:', MOCK_RACES_FROM_SCRAPERS.length);
console.log('Total races:', MOCK_RACES.length + MOCK_RACES_FROM_SCRAPERS.length);
console.log('');
console.log('Profile:', MOCK_PROFILE.displayName, '|', MOCK_PROFILE.club);
console.log('');
console.log('=== PRs ===');
MOCK_PRS.forEach(p => {
  const min = Math.floor(p.timeSeconds / 60);
  const sec = p.timeSeconds % 60;
  console.log(`  - ${p.distanceLabel}: ${min}:${sec.toString().padStart(2, '0')}`);
});
console.log('');
console.log('=== My races (calendario) ===');
MOCK_MY_RACES.forEach(m => {
  const race = MOCK_RACES.find(r => r._id === m.raceId);
  console.log(`  - ${m.status.padEnd(7)} | ${race?.name || m.raceId} | dorsal: ${m.dorsalNumber || '—'} | predicted: ${m.predictedTimeSeconds ? Math.floor(m.predictedTimeSeconds/60)+':'+(m.predictedTimeSeconds%60).toString().padStart(2,'0') : '—'}`);
});
console.log('');
console.log('=== Featured races (home) ===');
MOCK_RACES.filter(r => r.isFeatured).forEach(r => {
  console.log(`  - ${r.name} (${r.locality}, ${r.province})`);
});
console.log('');
console.log('=== Top races by votes (curated) ===');
MOCK_RACES.filter(r => r.votes && r.votes.length > 0).slice(0, 5).forEach(r => {
  const up = r.votes.filter((v:any) => v === 'up').length;
  console.log(`  - ${r.name}: ${up} up votes`);
});
