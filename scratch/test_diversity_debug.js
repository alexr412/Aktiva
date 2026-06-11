const { diversifyFeed, normalizeCategory } = require('../src/lib/ranking');

const candidates = [];

// The Strike
candidates.push({ id: 'the_strike', categories: ['entertainment.bowling_alley'], relevanceScore: 120 });

// 10 Bars
for (let i = 0; i < 10; i++) {
  candidates.push({ id: `bar_${i}`, categories: ['catering.bar'], relevanceScore: 90 - i });
}

// 10 Pools
for (let i = 0; i < 10; i++) {
  candidates.push({ id: `pool_${i}`, categories: ['sport.swimming_pool'], relevanceScore: 70 - i });
}

// 15 Cafes
for (let i = 0; i < 15; i++) {
  candidates.push({ id: `cafe_${i}`, categories: ['catering.cafe'], relevanceScore: 50 - i });
}

// 15 Restaurants
for (let i = 0; i < 15; i++) {
  candidates.push({ id: `restaurant_${i}`, categories: ['catering.restaurant'], relevanceScore: 40 - i });
}

console.log("Running diversifyFeed...");
const reranked = diversifyFeed(candidates);

console.log("\nPlaced items:");
reranked.forEach((item, idx) => {
  const norm = normalizeCategory(item.categories || []);
  console.log(`#${idx}: ${item.id} (cat: ${norm.primaryCategory}/${norm.subCategory}), relevance: ${item.relevanceScore}`);
});
