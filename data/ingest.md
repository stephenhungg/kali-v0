# content ingestion

> how tenzin handles different content types dropped in discord

## youtube links
- tool: `yt-dlp` (installed at `/opt/homebrew/bin/yt-dlp`)
- flow: download audio → whisper transcribe → summarize → file to wiki or gbrain
- command: `yt-dlp -x --audio-format mp3 -o /tmp/yt-%(id)s.%(ext)s <url>`
- usage: drop a youtube URL in chat, tenzin will transcribe + summarize

## web articles / dynamic sites
- tool: firecrawl MCP (wired in as of 2026-04-30)
- handles JS-rendered pages, paywalls (sometimes), complex SPAs
- fallback: WebFetch for simple static pages

## PDFs
- tool: Read tool (native claude capability)
- just drop the file path or attach in discord

## images
- tool: Read tool (multimodal)
- works for screenshots, mockups, designs

## zip files
- tool: Bash unzip + read contents
- flow: unzip to /tmp, inspect structure, read relevant files
- command: `unzip -o <file> -d /tmp/unzipped-<name>`

## audio/voice messages
- tool: STT (config slot exists, needs baseUrl wired — TBD)
- for now: drop audio file path and tenzin will note it's not yet transcribeable

## screen recordings
- tool: analyze-video skill (existing)
- trigger: auto-analyze-video skill proposed (pending approval)
