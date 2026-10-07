import urllib.request
import json
import re

with open('/Users/mac1/.gemini/antigravity/brain/6abaf165-6844-4c87-ba12-e58ce63a5a31/.system_generated/steps/258/content.md', 'r') as f:
    content = f.read()

# The text is likely in a next.js state or similar
parts = re.findall(r'\\"(.*?)\\"', content)
for part in parts:
    if "MediaTracking" in part or "Landing Page" in part or len(part.split()) > 20:
        if "\\u" not in part and "<" not in part and "{" not in part:
            print(part)
