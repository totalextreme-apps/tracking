const fs = require('fs');
const html = fs.readFileSync('/Users/mac1/.gemini/antigravity/brain/6abaf165-6844-4c87-ba12-e58ce63a5a31/.system_generated/steps/258/content.md', 'utf8');

// The conversation is usually stored in the HTML as JSON strings or text. Let's try to extract any large text blocks.
// Often it's in <script type="application/json" ...> or just plain text in the DOM.
// Since we don't have JSDOM, let's just strip HTML tags.
let text = html.replace(/<style[^>]*>.*?<\/style>/gis, '');
text = text.replace(/<script[^>]*>.*?<\/script>/gis, '');
text = text.replace(/<[^>]+>/g, ' ');
text = text.replace(/\s+/g, ' ');

// ChatGPT might load data via JSON. Let's look for "message" objects.
const matches = html.match(/"parts":\[(.*?)\]/g);
if (matches) {
    console.log("Found JSON parts:");
    matches.forEach(m => console.log(m.substring(0, 100) + '...'));
}

console.log("--- Extracted Text ---");
console.log(text.substring(0, 3000));
