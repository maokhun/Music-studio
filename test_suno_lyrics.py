import requests, json, sys
sys.stdout.reconfigure(encoding='utf-8')

song_id = "8c500ec4-c557-4756-80a2-ea3445c94f4b"
url = f"https://studio-api.prod.suno.com/api/clip/{song_id}"

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': f'https://suno.com/song/{song_id}',
    'Origin': 'https://suno.com',
}

r = requests.get(url, headers=headers)
data = r.json()
print("Keys in clip object:", list(data.keys()))
print("Title:", data.get('title'))
print("Metadata prompt (Lyrics):", data.get('metadata', {}).get('prompt'))
print("Style tags:", data.get('metadata', {}).get('tags'))
print("Audio URL:", data.get('audio_url'))
print("Video URL:", data.get('video_url'))
print("Image URL:", data.get('image_url'))
print("Duration:", data.get('metadata', {}).get('duration'))
