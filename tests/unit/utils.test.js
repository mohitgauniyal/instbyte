import { describe, it, expect } from 'vitest'

// ─── Functions under test ────────────────────────────────────────────────────
// These are copied from client/app.js. They are pure functions with no browser
// dependencies — safe to test in Node. When app.js is refactored to export a
// shared utils module, replace these copies with an import.

function formatSize(bytes) {
    if (!bytes) return "";
    if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + " GB";
    if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + " MB";
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
    return bytes + " B";
}

function getSizeTag(bytes) {
    if (!bytes) return "";
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) return "danger-dark";
    if (mb > 500) return "danger-light";
    if (mb > 100) return "warn";
    return "";
}

function looksLikeMarkdown(text) {
    return /^#{1,3} |[*_`~]|\[.+\]\(.+\)|^[-*+] |^\d+\. |^```/m.test(text);
}

const TEXT_EXTENSIONS = [
    'txt', 'md', 'js', 'ts', 'jsx', 'tsx', 'json', 'json5',
    'css', 'html', 'htm', 'xml', 'svg', 'sh', 'bash', 'zsh',
    'py', 'rb', 'php', 'java', 'c', 'cpp', 'h', 'cs', 'go',
    'rs', 'swift', 'kt', 'yaml', 'yml', 'toml', 'ini', 'env',
    'gitignore', 'dockerfile', 'sql', 'csv', 'log'
];

function getPreviewType(filename) {
    if (!filename) return "none";
    const ext = filename.split(".").pop().toLowerCase();
    if (/^(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(ext)) return "image";
    if (/^(mp4|webm|ogg|mov)$/.test(ext)) return "video";
    if (/^(mp3|wav|ogg|m4a|flac|aac)$/.test(ext)) return "audio";
    if (ext === "pdf") return "pdf";
    if (TEXT_EXTENSIONS.includes(ext)) return "text";
    return "none";
}

function getLanguage(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    const map = {
        js: "javascript", ts: "typescript", jsx: "javascript",
        tsx: "typescript", py: "python", rb: "ruby", php: "php",
        java: "java", c: "c", cpp: "cpp", h: "c", cs: "csharp",
        go: "go", rs: "rust", swift: "swift", kt: "kotlin",
        html: "html", htm: "html", css: "css", json: "json",
        json5: "json", xml: "xml", svg: "xml", sh: "bash",
        bash: "bash", zsh: "bash", yaml: "yaml", yml: "yaml",
        toml: "toml", sql: "sql", md: "markdown", csv: "plaintext",
        txt: "plaintext", log: "plaintext", env: "plaintext",
        dockerfile: "dockerfile"
    };
    return map[ext] || "plaintext";
}

function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ─── formatSize ──────────────────────────────────────────────────────────────

describe('formatSize', () => {
    it('returns empty string for 0', () => {
        expect(formatSize(0)).toBe("")
    })

    it('returns empty string for falsy values', () => {
        expect(formatSize(null)).toBe("")
        expect(formatSize(undefined)).toBe("")
    })

    it('formats bytes correctly', () => {
        expect(formatSize(500)).toBe("500 B")
        expect(formatSize(1)).toBe("1 B")
    })

    it('formats KB correctly', () => {
        expect(formatSize(1024)).toBe("1.0 KB")
        expect(formatSize(2048)).toBe("2.0 KB")
        expect(formatSize(1536)).toBe("1.5 KB")
    })

    it('formats MB correctly', () => {
        expect(formatSize(1024 ** 2)).toBe("1.0 MB")
        expect(formatSize(512 * 1024 ** 2 / 1024)).toBe("512.0 KB") // just under MB threshold
    })

    it('formats GB correctly', () => {
        expect(formatSize(1024 ** 3)).toBe("1.0 GB")
        expect(formatSize(2 * 1024 ** 3)).toBe("2.0 GB")
    })

    it('formats with one decimal place', () => {
        expect(formatSize(1.5 * 1024 ** 2)).toBe("1.5 MB")
        expect(formatSize(1.5 * 1024 ** 3)).toBe("1.5 GB")
    })
})

// ─── getSizeTag ───────────────────────────────────────────────────────────────

describe('getSizeTag', () => {
    it('returns empty string for falsy values', () => {
        expect(getSizeTag(0)).toBe("")
        expect(getSizeTag(null)).toBe("")
    })

    it('returns empty string for small files under 100MB', () => {
        expect(getSizeTag(50 * 1024 * 1024)).toBe("")
        expect(getSizeTag(1024)).toBe("")
    })

    it('returns warn for files over 100MB', () => {
        expect(getSizeTag(101 * 1024 * 1024)).toBe("warn")
        expect(getSizeTag(200 * 1024 * 1024)).toBe("warn")
    })

    it('returns danger-light for files over 500MB', () => {
        expect(getSizeTag(501 * 1024 * 1024)).toBe("danger-light")
        expect(getSizeTag(800 * 1024 * 1024)).toBe("danger-light")
    })

    it('returns danger-dark for files over 1GB', () => {
        expect(getSizeTag(1025 * 1024 * 1024)).toBe("danger-dark")
        expect(getSizeTag(2 * 1024 ** 3)).toBe("danger-dark")
    })
})

// ─── looksLikeMarkdown ────────────────────────────────────────────────────────

describe('looksLikeMarkdown', () => {
    it('detects headings', () => {
        expect(looksLikeMarkdown("# Hello")).toBe(true)
        expect(looksLikeMarkdown("## Hello")).toBe(true)
        expect(looksLikeMarkdown("### Hello")).toBe(true)
    })

    it('detects bold and italic', () => {
        expect(looksLikeMarkdown("**bold**")).toBe(true)
        expect(looksLikeMarkdown("_italic_")).toBe(true)
        expect(looksLikeMarkdown("*italic*")).toBe(true)
    })

    it('detects inline code', () => {
        expect(looksLikeMarkdown("`code`")).toBe(true)
    })

    it('detects code blocks', () => {
        expect(looksLikeMarkdown("```js\nconsole.log('hi')\n```")).toBe(true)
    })

    it('detects links', () => {
        expect(looksLikeMarkdown("[click here](https://example.com)")).toBe(true)
    })

    it('detects unordered lists', () => {
        expect(looksLikeMarkdown("- item one")).toBe(true)
        expect(looksLikeMarkdown("* item one")).toBe(true)
        expect(looksLikeMarkdown("+ item one")).toBe(true)
    })

    it('detects ordered lists', () => {
        expect(looksLikeMarkdown("1. first item")).toBe(true)
    })

    it('returns false for plain text', () => {
        expect(looksLikeMarkdown("hello world")).toBe(false)
        expect(looksLikeMarkdown("just a normal message")).toBe(false)
        expect(looksLikeMarkdown("some url: https://example.com")).toBe(false)
    })

    it('returns false for empty string', () => {
        expect(looksLikeMarkdown("")).toBe(false)
    })
})

// ─── getPreviewType ───────────────────────────────────────────────────────────

describe('getPreviewType', () => {
    it('returns none for missing filename', () => {
        expect(getPreviewType(null)).toBe("none")
        expect(getPreviewType(undefined)).toBe("none")
        expect(getPreviewType("")).toBe("none")
    })

    it('identifies image files', () => {
        expect(getPreviewType("photo.jpg")).toBe("image")
        expect(getPreviewType("photo.jpeg")).toBe("image")
        expect(getPreviewType("photo.png")).toBe("image")
        expect(getPreviewType("photo.gif")).toBe("image")
        expect(getPreviewType("photo.webp")).toBe("image")
        expect(getPreviewType("photo.bmp")).toBe("image")
        expect(getPreviewType("icon.svg")).toBe("image")
    })

    it('identifies video files', () => {
        expect(getPreviewType("video.mp4")).toBe("video")
        expect(getPreviewType("video.webm")).toBe("video")
        expect(getPreviewType("video.mov")).toBe("video")
        // NOTE: .ogg matches the video regex before the audio regex —
        // this is a known quirk in getPreviewType. The browser handles
        // both video/ogg and audio/ogg fine via <video> element.
        expect(getPreviewType("file.ogg")).toBe("video")
    })

    it('identifies audio files', () => {
        expect(getPreviewType("song.mp3")).toBe("audio")
        expect(getPreviewType("song.wav")).toBe("audio")
        expect(getPreviewType("song.m4a")).toBe("audio")
        expect(getPreviewType("song.flac")).toBe("audio")
        expect(getPreviewType("song.aac")).toBe("audio")
    })

    it('identifies PDF files', () => {
        expect(getPreviewType("document.pdf")).toBe("pdf")
    })

    it('identifies text/code files', () => {
        expect(getPreviewType("app.js")).toBe("text")
        expect(getPreviewType("styles.css")).toBe("text")
        expect(getPreviewType("data.json")).toBe("text")
        expect(getPreviewType("README.md")).toBe("text")
        expect(getPreviewType("script.py")).toBe("text")
        expect(getPreviewType("config.yml")).toBe("text")
    })

    it('returns none for unsupported types', () => {
        expect(getPreviewType("archive.zip")).toBe("none")
        expect(getPreviewType("binary.exe")).toBe("none")
        expect(getPreviewType("font.ttf")).toBe("none")
    })

    it('is case insensitive', () => {
        expect(getPreviewType("PHOTO.JPG")).toBe("image")
        expect(getPreviewType("VIDEO.MP4")).toBe("video")
        expect(getPreviewType("APP.JS")).toBe("text")
    })
})

// ─── getLanguage ──────────────────────────────────────────────────────────────

describe('getLanguage', () => {
    it('identifies JavaScript files', () => {
        expect(getLanguage("app.js")).toBe("javascript")
        expect(getLanguage("component.jsx")).toBe("javascript")
    })

    it('identifies TypeScript files', () => {
        expect(getLanguage("app.ts")).toBe("typescript")
        expect(getLanguage("component.tsx")).toBe("typescript")
    })

    it('identifies common languages', () => {
        expect(getLanguage("script.py")).toBe("python")
        expect(getLanguage("main.go")).toBe("go")
        expect(getLanguage("app.rs")).toBe("rust")
        expect(getLanguage("Main.java")).toBe("java")
        expect(getLanguage("styles.css")).toBe("css")
        expect(getLanguage("index.html")).toBe("html")
        expect(getLanguage("data.json")).toBe("json")
        expect(getLanguage("query.sql")).toBe("sql")
    })

    it('identifies config files', () => {
        expect(getLanguage("config.yml")).toBe("yaml")
        expect(getLanguage("config.yaml")).toBe("yaml")
        expect(getLanguage("config.toml")).toBe("toml")
    })

    it('identifies shell scripts', () => {
        expect(getLanguage("deploy.sh")).toBe("bash")
        expect(getLanguage("setup.bash")).toBe("bash")
        expect(getLanguage("config.zsh")).toBe("bash")
    })

    it('returns plaintext for unknown extensions', () => {
        expect(getLanguage("file.xyz")).toBe("plaintext")
        expect(getLanguage("data.csv")).toBe("plaintext")
        expect(getLanguage("app.log")).toBe("plaintext")
    })
})

// ─── escapeHtml ───────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
    it('returns empty string for falsy input', () => {
        expect(escapeHtml("")).toBe("")
        expect(escapeHtml(null)).toBe("")
        expect(escapeHtml(undefined)).toBe("")
    })

    it('escapes ampersands', () => {
        expect(escapeHtml("a & b")).toBe("a &amp; b")
    })

    it('escapes angle brackets', () => {
        expect(escapeHtml("<script>")).toBe("&lt;script&gt;")
    })

    it('escapes double quotes', () => {
        expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;")
    })

    it('escapes all special chars together', () => {
        expect(escapeHtml('<a href="x">click & go</a>'))
            .toBe('&lt;a href=&quot;x&quot;&gt;click &amp; go&lt;/a&gt;')
    })

    it('leaves plain text unchanged', () => {
        expect(escapeHtml("hello world")).toBe("hello world")
    })
})
