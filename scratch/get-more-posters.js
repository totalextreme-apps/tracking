require('dotenv').config({ path: '.env' });
const API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY;

const titles = [
  "The Girl Next Door",
  "Mean Girls",
  "White Chicks",
  "Legally Blonde",
  "Bring It On",
  "Clueless",
  "10 Things I Hate About You",
  "Heathers",
  "Cruel Intentions",
  "American Pie"
];

async function fetchPosters() {
  for (const title of titles) {
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(title)}`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      console.log(`"${data.results[0].poster_path}", // ${title}`);
    } else {
      console.log(`// No poster found for ${title}`);
    }
  }
}

fetchPosters();
