require('dotenv').config({ path: '.env' });
const API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY;

const titles = [
  "A Nightmare on Elm Street",
  "Child's Play",
  "Halloween",
  "Night of the Creeps",
  "The Thing",
  "Evil Dead II",
  "Friday the 13th",
  "Hellraiser",
  "The Texas Chain Saw Massacre",
  "Re-Animator",
  "The Return of the Living Dead",
  "Phantasm",
  "Videodrome",
  "The Shining",
  "Alien",
  "Scream",
  "Candyman",
  "The Fly",
  "An American Werewolf in London",
  "Suspiria"
];

async function main() {
  const posters = [];
  for (const title of titles) {
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(title)}`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const match = data.results.find(r => r.title.toLowerCase() === title.toLowerCase()) || data.results[0];
      if (match && match.poster_path) {
         posters.push(match.poster_path);
      }
    }
  }
  console.log(JSON.stringify(posters));
}
main();
