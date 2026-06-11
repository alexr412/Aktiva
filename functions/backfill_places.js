const fs = require('fs');
const path = require('path');
const { UserRefreshClient } = require('google-auth-library');
const { Firestore } = require('@google-cloud/firestore');

// Safe loading of Firebase CLI credentials
let db;
try {
  const userProfile = process.env.USERPROFILE || process.env.HOME || '';
  const toolsConfigPath = path.join(userProfile, '.config/configstore/firebase-tools.json');
  if (fs.existsSync(toolsConfigPath)) {
    const toolsConfig = JSON.parse(fs.readFileSync(toolsConfigPath, 'utf8'));
    const refreshToken = toolsConfig.tokens?.refresh_token;
    if (refreshToken) {
      const authClient = new UserRefreshClient(
        '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
        'j9iVZfS8kkCEFUPaAeJV0sAi',
        refreshToken
      );
      db = new Firestore({
        projectId: 'activa-444220',
        authClient
      });
      console.log("Authenticated and initialized Firestore using Firebase CLI credentials.");
    }
  }
} catch (e) {
  console.warn("Failed to load Firebase CLI credentials:", e.message);
}

if (!db) {
  console.error("Failed to initialize database client. Exiting.");
  process.exit(1);
}

// Copy helpers for self-containment
function normalizeCity(city) {
  if (!city) return "";
  return city
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizePlaceName(name) {
  if (!name) return "";
  let str = "";
  if (typeof name === "string") {
    str = name;
  } else if (typeof name === "object") {
    str = name.de || name.en || Object.values(name).find(v => typeof v === "string") || "";
  } else {
    str = String(name);
  }
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeCategory(categories) {
  if (!categories || categories.length === 0) {
    return { primaryCategory: 'other', subCategory: 'other' };
  }

  for (const cat of categories) {
    const clean = cat.toLowerCase();
    
    if (clean.includes('cinema')) {
      return { primaryCategory: 'entertainment', subCategory: 'cinema' };
    }
    if (
      clean.includes('swimming_pool') ||
      clean.includes('swimming') ||
      clean === 'sport.swimming' ||
      clean.includes('pool') ||
      clean.includes('bath') ||
      clean.includes('freibad') ||
      clean.includes('hallenbad') ||
      clean.includes('naturbad') ||
      clean.includes('wasserpark') ||
      clean.includes('water_park') ||
      clean.includes('aquatic')
    ) {
      return { primaryCategory: 'sports', subCategory: 'swimming_pool' };
    }
    if (
      clean.includes('spa') ||
      clean.includes('sauna') ||
      clean.includes('therme') ||
      clean.includes('thermal') ||
      clean.includes('wellness')
    ) {
      return { primaryCategory: 'wellness', subCategory: 'spa' };
    }
    if (clean.includes('miniature_golf') || clean.includes('minigolf')) {
      return { primaryCategory: 'entertainment', subCategory: 'minigolf' };
    }
    if (clean.includes('bowling_alley') || clean.includes('bowling')) {
      return { primaryCategory: 'entertainment', subCategory: 'bowling' };
    }
    if (clean.includes('zoo')) {
      return { primaryCategory: 'nature', subCategory: 'zoo' };
    }
    if (clean === 'catering.cafe' || clean.includes('.cafe') || clean === 'cafe') {
      return { primaryCategory: 'food', subCategory: 'cafe' };
    }
    if (clean === 'catering.restaurant' || clean.includes('.restaurant') || clean === 'restaurant') {
      return { primaryCategory: 'food', subCategory: 'restaurant' };
    }
    if (clean === 'catering.bar' || clean === 'catering.pub' || clean.includes('.bar') || clean.includes('.pub') || clean === 'bar' || clean === 'pub' || clean === 'adult.nightclub' || clean.includes('nightclub')) {
      return { primaryCategory: 'nightlife', subCategory: 'bar' };
    }
  }

  for (const cat of categories) {
    const parts = cat.toLowerCase().split('.');
    const root = parts[0];
    const sub = parts.slice(1).join('_') || 'other';

    if (root === 'catering') return { primaryCategory: 'food', subCategory: sub };
    if (root === 'entertainment') return { primaryCategory: 'entertainment', subCategory: sub };
    if (root === 'sport') return { primaryCategory: 'sports', subCategory: sub };
    if (root === 'natural' || (root === 'leisure' && (sub.includes('park') || sub.includes('garden') || sub.includes('nature')))) {
      return { primaryCategory: 'nature', subCategory: sub };
    }
    if (root === 'leisure') return { primaryCategory: 'leisure', subCategory: sub };
    if (root === 'tourism') return { primaryCategory: 'tourism', subCategory: sub };
    if (root === 'adult') return { primaryCategory: 'nightlife', subCategory: sub };
  }

  const first = categories[0].toLowerCase();
  const parts = first.split('.');
  return {
    primaryCategory: parts[0] || 'other',
    subCategory: parts.slice(1).join('_') || 'other'
  };
}

function extractCity(address) {
  if (!address) return "";
  
  const match = address.match(/\b\d{5}\s+([A-Za-zÄäÖöÜüß\-]+)/);
  if (match && match[1]) {
    return match[1];
  }
  
  const parts = address.split(',');
  if (parts.length >= 2) {
    const potential = parts[parts.length - 2].trim().replace(/\d+/g, '').trim();
    if (potential && potential.length > 2) return potential;
  }
  return "";
}

function isLocallyBielefeld(lat, lon) {
  return typeof lat === 'number' && typeof lon === 'number' &&
         lat >= 51.90 && lat <= 52.15 &&
         lon >= 8.35 && lon <= 8.65;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || !args.includes('--write');
  const isForce = args.includes('--force');

  console.log(`Starting admin migration script... Mode: ${isDryRun ? 'DRY-RUN' : 'WRITE'}, Force Overwrite: ${isForce}\n`);

  const colRef = db.collection('places');
  const snap = await colRef.get();

  let totalPlaces = snap.size;
  let updatedCount = 0;
  let needsCityReviewCount = 0;
  let setCityNormalizedCount = 0;
  let setNormalizedNameCount = 0;
  let setCategoriesCount = 0;
  let setGeoapifyIdCount = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const docId = docSnap.id;
    const name = data.name || '';
    const address = data.address || '';
    const lat = data.lat;
    const lon = data.lon;
    const categories = data.categories || [];

    const updates = {};

    // 1. cityNormalized derivation
    let derivedCity = "";
    if (data.city) {
      derivedCity = data.city;
    } else if (data.properties && data.properties.city) {
      derivedCity = data.properties.city;
    } else if (address) {
      derivedCity = extractCity(address);
    }
    
    if (!derivedCity && isLocallyBielefeld(lat, lon)) {
      derivedCity = "Bielefeld";
    }

    let cityNorm = normalizeCity(derivedCity);

    if (!cityNorm) {
      needsCityReviewCount++;
      console.warn(`[WARNING] Needs city review: Place "${name}" (ID: ${docId}) - No city could be derived.`);
    }

    if (cityNorm && (!data.cityNormalized || isForce)) {
      updates.cityNormalized = cityNorm;
      setCityNormalizedCount++;
    }

    // 2. normalizedName
    const normName = normalizePlaceName(name);
    if (normName && (!data.normalizedName || isForce)) {
      updates.normalizedName = normName;
      setNormalizedNameCount++;
    }

    // 3. Category Normalization
    const { primaryCategory, subCategory } = normalizeCategory(categories);
    if (primaryCategory && (!data.primaryCategory || isForce)) {
      updates.primaryCategory = primaryCategory;
      setCategoriesCount++;
    }
    if (subCategory && (!data.subCategory || isForce)) {
      updates.subCategory = subCategory;
    }

    // 4. geoapifyId
    if (docId.startsWith('51') && docId.length > 30 && (!data.geoapifyId || isForce)) {
      updates.geoapifyId = docId;
      setGeoapifyIdCount++;
    }

    if (Object.keys(updates).length > 0) {
      console.log(`[PENDING UPDATE] Doc: "${name}" (ID: ${docId})`);
      console.log(`  Changes: ${JSON.stringify(updates, null, 2)}`);
      updatedCount++;

      if (!isDryRun) {
        const docRef = colRef.doc(docId);
        await docRef.update(updates);
        console.log(`  [SUCCESS] Written to Firestore.`);
      }
    }
  }

  console.log('\n================ MIGRATION SUMMARY ================');
  console.log(`Gesamtzahl geprüfter Places:   ${totalPlaces}`);
  console.log(`Anzahl zu aktualisierender Places: ${updatedCount}`);
  console.log(`Anzahl NEEDS_CITY_REVIEW:       ${needsCityReviewCount}`);
  console.log(`Anzahl gesetzter cityNormalized: ${setCityNormalizedCount}`);
  console.log(`Anzahl gesetzter normalizedName: ${setNormalizedNameCount}`);
  console.log(`Anzahl gesetzter Kategorien:     ${setCategoriesCount}`);
  console.log(`Anzahl gesetzter geoapifyId:     ${setGeoapifyIdCount}`);
  console.log('===================================================\n');

  if (isDryRun && updatedCount > 0) {
    console.log('Use "node backfill_places.js --write" to apply these changes to Firestore.');
  }
}

main().catch(console.error);
