const socket = io();

async function applyBranding() {
    try {
        const res = await fetch("/branding");
        const b = await res.json();

        // Update page title and app name
        document.title = b.appName;
        const nameEl = document.getElementById("appName");
        if (nameEl) nameEl.innerText = b.appName;

        // Update logo src to dynamic route
        const logoEl = document.getElementById("appLogo");
        if (logoEl) logoEl.src = "/logo-dynamic.png";

        // Inject CSS variables
        const p = b.palette;
        const root = document.documentElement;
        root.style.setProperty("--color-primary", p.primary);
        root.style.setProperty("--color-primary-hover", p.primaryHover);
        root.style.setProperty("--color-primary-light", p.primaryLight);
        root.style.setProperty("--color-primary-dark", p.primaryDark);
        root.style.setProperty("--color-on-primary", p.onPrimary);
        root.style.setProperty("--color-secondary", p.secondary);
        root.style.setProperty("--color-secondary-hover", p.secondaryHover);
        root.style.setProperty("--color-secondary-light", p.secondaryLight);
        root.style.setProperty("--color-on-secondary", p.onSecondary);

    } catch (e) {
        // Branding failed — default styles remain, no crash
    }
}
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

// Configure marked
marked.setOptions({
    breaks: true,
    gfm: true
});

function looksLikeMarkdown(text) {
    return /^#{1,3} |[*_`~]|\[.+\]\(.+\)|^[-*+] |^\d+\. |^```/m.test(text);
}

function renderText(text) {
    if (!text) return "";
    if (looksLikeMarkdown(text)) {
        const html = marked.parse(text);
        // highlight code blocks after parse
        const wrap = document.createElement("div");
        wrap.innerHTML = html;
        wrap.querySelectorAll("pre code").forEach(el => hljs.highlightElement(el));
        return `<div class="markdown-body">${wrap.innerHTML}</div>`;
    }
    // plain text — just escape and preserve newlines
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
}

const TEXT_EXTENSIONS = [
    'txt', 'md', 'js', 'ts', 'jsx', 'tsx', 'json', 'json5',
    'css', 'html', 'htm', 'xml', 'svg', 'sh', 'bash', 'zsh',
    'py', 'rb', 'php', 'java', 'c', 'cpp', 'h', 'cs', 'go',
    'rs', 'swift', 'kt', 'yaml', 'yml', 'toml', 'ini', 'env',
    'gitignore', 'dockerfile', 'sql', 'csv', 'log'
];

const MAX_TEXT_PREVIEW_BYTES = 50 * 1024; // 50KB — beyond this we warn
const MAX_TEXT_LINES = 200;

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

let openPreviewId = null;

async function togglePreview(id, filename) {
    const panel = document.getElementById("preview-" + id);
    const btn = document.getElementById("prevbtn-" + id);
    if (!panel || !btn) return;

    const isOpen = panel.classList.contains("open");

    // Close any other open preview first
    if (openPreviewId && openPreviewId !== id) {
        const otherPanel = document.getElementById("preview-" + openPreviewId);
        const otherBtn = document.getElementById("prevbtn-" + openPreviewId);
        if (otherPanel) otherPanel.classList.remove("open");
        if (otherBtn) otherBtn.classList.remove("preview-active");
    }

    if (isOpen) {
        panel.classList.remove("open");
        btn.classList.remove("preview-active");
        openPreviewId = null;
        return;
    }

    // Open this one
    panel.classList.add("open");
    btn.classList.add("preview-active");
    openPreviewId = id;

    // Only build content once
    if (panel.dataset.loaded) return;
    panel.dataset.loaded = "true";

    const type = getPreviewType(filename);
    const url = `/uploads/${filename}`;

    if (type === "image") {
        panel.innerHTML = `<img src="${url}" alt="${filename}">`;

    } else if (type === "video") {
        panel.innerHTML = `
      <video controls preload="metadata">
        <source src="${url}">
        Your browser doesn't support video preview.
      </video>`;

    } else if (type === "audio") {
        panel.innerHTML = `
      <audio controls preload="metadata">
        <source src="${url}">
        Your browser doesn't support audio preview.
      </audio>`;

    } else if (type === "pdf") {
        panel.innerHTML = `<embed src="${url}" type="application/pdf">`;

    } else if (type === "text") {
        panel.innerHTML = `<div class="preview-loading">Loading...</div>`;

        try {
            const res = await fetch(url);

            if (!res.ok) throw new Error("Failed to load");

            // Check size via content-length header before reading
            const contentLength = res.headers.get("content-length");
            if (contentLength && parseInt(contentLength) > MAX_TEXT_PREVIEW_BYTES) {
                panel.innerHTML = `
          <div class="preview-error">
            File is too large to preview (${formatSize(parseInt(contentLength))}).
            <a href="${url}" target="_blank">Open in new tab</a>
          </div>`;
                return;
            }

            const text = await res.text();
            const lines = text.split("\n");
            const truncated = lines.length > MAX_TEXT_LINES;
            const preview = truncated
                ? lines.slice(0, MAX_TEXT_LINES).join("\n")
                : text;

            const lang = getLanguage(filename);
            const code = document.createElement("code");
            code.className = `language-${lang}`;
            code.textContent = preview;

            const pre = document.createElement("pre");
            pre.appendChild(code);
            hljs.highlightElement(code);

            panel.innerHTML = "";
            panel.appendChild(pre);

            if (truncated) {
                const note = document.createElement("div");
                note.className = "preview-truncated";
                note.innerHTML = `Showing first ${MAX_TEXT_LINES} of ${lines.length} lines. <a href="${url}" target="_blank">View full file</a>`;
                panel.appendChild(note);
            }

        } catch (err) {
            panel.innerHTML = `
        <div class="preview-error">
          Could not load preview. <a href="${url}" target="_blank">Open directly</a>
        </div>`;
        }
    }
}

function handleRowClick(el, type, value) {
    if (type === "text") {
        navigator.clipboard.writeText(value).then(() => {
            el.classList.add("flash");
            setTimeout(() => el.classList.remove("flash"), 800);
        });
    } else {
        const a = document.createElement("a");
        a.href = value;
        a.download = "";
        a.click();
    }
}

let openDropdown = null;

function toggleMoveDropdown(e, id, currentChannel) {
    e.stopPropagation();

    // close any open one first
    if (openDropdown && openDropdown !== e.currentTarget.nextElementSibling) {
        openDropdown.classList.remove("open");
    }

    const dropdown = e.currentTarget.nextElementSibling;
    const isOpen = dropdown.classList.contains("open");

    if (isOpen) {
        dropdown.classList.remove("open");
        openDropdown = null;
        return;
    }

    // build channel list fresh each time (channels may have changed)
    const others = channels.filter(c => c.name !== currentChannel);
    dropdown.innerHTML = `<div class="dropdown-label">Move to</div>`;

    others.forEach(ch => {
        const btn = document.createElement("button");
        btn.innerText = ch.name;
        btn.onclick = (ev) => {
            ev.stopPropagation();
            moveItem(id, ch.name);
            dropdown.classList.remove("open");
            openDropdown = null;
        };
        dropdown.appendChild(btn);
    });

    dropdown.classList.add("open");
    openDropdown = dropdown;
}

async function moveItem(id, toChannel) {
    await fetch(`/item/${id}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: toChannel })
    });
    // socket will handle the re-render via item-moved event
}

document.addEventListener("click", () => {
    if (openDropdown) {
        openDropdown.classList.remove("open");
        openDropdown = null;
    }
});

let channel = null;
let channels = [];

let uploader = localStorage.getItem("name") || "";

async function initName() {
    if (!uploader || uploader === "null" || uploader.trim() === "") {
        let suggested = "USER-" + Math.floor(Math.random() * 1000);
        const ua = navigator.userAgent;
        if (/android/i.test(ua)) suggested = "Android-" + Math.floor(Math.random() * 1000);
        else if (/iphone|ipad/i.test(ua)) suggested = "iPhone-" + Math.floor(Math.random() * 1000);
        else if (/mac/i.test(ua)) suggested = "Mac-" + Math.floor(Math.random() * 1000);
        else if (/windows/i.test(ua)) suggested = "Windows-" + Math.floor(Math.random() * 1000);
        else if (/linux/i.test(ua)) suggested = "Linux-" + Math.floor(Math.random() * 1000);
        else suggested = "User-" + Math.floor(Math.random() * 1000);
        uploader = prompt("Your name?", suggested) || suggested;
        localStorage.setItem("name", uploader);
    }
    document.getElementById("who").innerText = "You: " + uploader;
    socket.emit("join", uploader);
}

function highlight() {
    document.querySelectorAll(".channels button")
        .forEach(b => b.classList.remove("active"));
    const el = document.getElementById("ch-" + channel);
    if (el) el.classList.add("active");
}

function setChannel(c) {
    channel = c;
    renderChannels();
    highlight();
    load();
}

async function load() {
    const res = await fetch("/items/" + channel);
    const data = await res.json();
    render(data);
}

function render(data) {
    const el = document.getElementById("items");
    el.innerHTML = "";

    if (!data.length) {
        el.innerHTML = `<div class="empty-state">Nothing here yet — paste, type, or drop a file to share</div>`;
        return;
    }

    data.forEach(i => {
        const div = document.createElement("div");
        div.className = "item";

        let content = "";

        if (i.type === "file") {
            const isImg = i.filename.match(/\.(jpg|png|jpeg|gif)$/i);
            const sizeLabel = formatSize(i.size);
            const sizeClass = getSizeTag(i.size);
            const sizeTag = sizeClass
                ? `<span class="size-tag ${sizeClass}">${sizeLabel}</span>`
                : sizeLabel
                    ? `<span style="font-size:11px;color:#9ca3af;margin-left:6px;">${sizeLabel}</span>`
                    : "";

            if (isImg) {
                content = `<img src="/uploads/${i.filename}" style="max-width:200px;border-radius:6px"><br>
        <a href="/uploads/${i.filename}" target="_blank">${i.filename}</a>${sizeTag}`;
            } else {
                content = `<a href="/uploads/${i.filename}" target="_blank">${i.filename}</a>${sizeTag}`;
            }
        } else {
            const isLink = i.content && i.content.startsWith("http");
            if (isLink) {
                content = `<a href="${i.content}" target="_blank">${i.content}</a>`;
            } else {
                content = renderText(i.content);
            }
        }

        const pinText = i.pinned ? "unpin" : "pin";

        const isFile = i.type === "file";
        const clickValue = isFile
            ? `/uploads/${i.filename}`
            : i.content;
        const tooltip = isFile ? "Click to download" : "Click to copy";

        div.innerHTML = `
  <div class="item-top">
    <div class="left"
     data-tooltip="${i.type === 'file' ? 'Click to download' : 'Click to copy'}"
     onclick="${i.type === 'file'
                ? `handleRowClick(this, 'file', '/uploads/${i.filename}')`
                : `handleRowClick(this, 'text', '${(i.content || '').replace(/'/g, "\\'")}')`}">
  ${content}
  <div class="meta">${i.uploader}</div>
</div>
    <div class="item-actions">
     ${getPreviewType(i.filename) !== "none" && getPreviewType(i.filename) !== "image"
                ? `<button class="icon-btn" id="prevbtn-${i.id}"
       onclick="togglePreview(${i.id}, '${i.filename}')"
       title="Preview">👁</button>`
                : ""}
      <button class="icon-btn" onclick="pin(${i.id})" title="${i.pinned ? 'Unpin' : 'Pin'}">
        ${i.pinned ? "📍" : "📌"}
      </button>
      <div class="move-wrapper">
        <button class="icon-btn" title="Move to channel"
          onclick="toggleMoveDropdown(event, ${i.id}, '${i.channel}')">⇄</button>
        <div class="move-dropdown"></div>
      </div>
      <button class="icon-btn delete" onclick="del(${i.id}, ${i.pinned})" title="Delete">🗑</button>

    </div>
  </div>
  <div class="preview-panel" id="preview-${i.id}"></div>
`;
        el.appendChild(div);
    });
}

function renderGrouped(data) {
    const el = document.getElementById("items");
    el.innerHTML = "";

    if (!data.length) {
        el.innerHTML = "<div style='color:#6b7280;margin-top:10px;'>No results</div>";
        return;
    }

    // group by channel
    const grouped = {};
    data.forEach(item => {
        if (!grouped[item.channel]) grouped[item.channel] = [];
        grouped[item.channel].push(item);
    });

    Object.keys(grouped).forEach(ch => {
        const section = document.createElement("div");
        section.style.marginTop = "20px";

        section.innerHTML = `
      <div style="font-size:13px;font-weight:600;color:#6b7280;margin-bottom:8px;">
        ${ch.toUpperCase()}
      </div>
    `;

        grouped[ch].forEach(i => {
            const div = document.createElement("div");
            div.className = "item";

            let content = "";

            if (i.type === "file") {
                const isImg = i.filename.match(/\.(jpg|png|jpeg|gif)$/i);
                const sizeLabel = formatSize(i.size);
                const sizeClass = getSizeTag(i.size);
                const sizeTag = sizeClass
                    ? `<span class="size-tag ${sizeClass}">${sizeLabel}</span>`
                    : sizeLabel
                        ? `<span style="font-size:11px;color:#9ca3af;margin-left:6px;">${sizeLabel}</span>`
                        : "";

                if (isImg) {
                    content = `<img src="/uploads/${i.filename}" style="max-width:200px;border-radius:6px"><br>
        <a href="/uploads/${i.filename}" target="_blank">${i.filename}</a>${sizeTag}`;
                } else {
                    content = `<a href="/uploads/${i.filename}" target="_blank">${i.filename}</a>${sizeTag}`;
                }
            } else {
                const isLink = i.content && i.content.startsWith("http");
                if (isLink) {
                    content = `<a href="${i.content}" target="_blank">${i.content}</a>`;
                } else {
                    content = renderText(i.content);
                }
            }

            const isFile = i.type === "file";
            const clickValue = isFile
                ? `/uploads/${i.filename}`
                : i.content;
            const tooltip = isFile ? "Click to download" : "Click to copy";

            div.innerHTML = `
  <div class="item-top">
    <div class="left"
     data-tooltip="${i.type === 'file' ? 'Click to download' : 'Click to copy'}"
     onclick="${i.type === 'file'
                    ? `handleRowClick(this, 'file', '/uploads/${i.filename}')`
                    : `handleRowClick(this, 'text', '${(i.content || '').replace(/'/g, "\\'")}')`}">
  ${content}
  <div class="meta">${i.uploader}</div>
</div>
    <div class="item-actions">
      ${getPreviewType(i.filename) !== "none" && getPreviewType(i.filename) !== "image"
                    ? `<button class="icon-btn" id="prevbtn-${i.id}"
       onclick="togglePreview(${i.id}, '${i.filename}')"
       title="Preview">👁</button>`
                    : ""}
      <button class="icon-btn" onclick="pin(${i.id})" title="${i.pinned ? 'Unpin' : 'Pin'}">
        ${i.pinned ? "📍" : "📌"}
      </button>
      <div class="move-wrapper">
        <button class="icon-btn" title="Move to channel"
          onclick="toggleMoveDropdown(event, ${i.id}, '${i.channel}')">⇄</button>
        <div class="move-dropdown"></div>
      </div>
      <button class="icon-btn delete" onclick="del(${i.id}, ${i.pinned})" title="Delete">🗑</button>

    </div>
  </div>
  <div class="preview-panel" id="preview-${i.id}"></div>
`;

            section.appendChild(div);
        });

        el.appendChild(section);
    });
}

async function sendText() {
    const input = document.getElementById("msg");
    const text = input.value.trim();
    if (!text) return;

    await fetch("/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, channel, uploader })
    });

    input.value = "";
}

function handleEnter(e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendText();
    }
}

function changeName() {
    const n = prompt("Enter name:");
    if (!n) return;
    uploader = n;
    localStorage.setItem("name", n);
    document.getElementById("who").innerText = "You: " + uploader;
}

let qrLoaded = false;

async function toggleQR() {
    const card = document.getElementById("qrCard");
    card.classList.toggle("open");

    if (card.classList.contains("open") && !qrLoaded) {
        const res = await fetch("/info");
        const { url } = await res.json();
        document.getElementById("qrUrl").innerText = url;
        document.getElementById("qrImg").src =
            `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`;
        qrLoaded = true;
    }
}

document.addEventListener("click", e => {
    const widget = document.querySelector(".qr-widget");
    if (!widget.contains(e.target)) {
        document.getElementById("qrCard").classList.remove("open");
    }
});

const fileInput = document.getElementById("fileInput");

fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (file) uploadFile(file);
};

async function del(id, pinned) {
    if (pinned) {
        const confirmed = confirm("This item is pinned. Are you sure you want to delete it?");
        if (!confirmed) return;
    }
    await fetch("/item/" + id, { method: "DELETE" });
}

async function pin(id) {
    await fetch("/pin/" + id, { method: "POST" });
    load();
}


async function logout() {
    await fetch("/logout", { method: "POST" });
    window.location.href = "/login";
}

socket.on("new-item", item => {
    if (item.channel === channel) load();
});

socket.on("delete-item", id => {
    load();
});

socket.on("item-moved", ({ id, channel: toChannel }) => {
    if (toChannel !== channel) {
        // item left this channel — remove it from view
        load();
    }
});

socket.on("channel-added", (ch) => {
    if (!channels.find(c => c.name === ch.name)) {
        channels.push(ch);
        renderChannels();
    }
});

socket.on("channel-deleted", ({ name }) => {
    channels = channels.filter(c => c.name !== name);
    if (channel === name) {
        channel = channels.length ? channels[0].name : null;
        load();
    }
    renderChannels();
    highlight();
});

socket.on("channel-renamed", ({ oldName, newName }) => {
    channels = channels.map(c => c.name === oldName ? { ...c, name: newName } : c);
    if (channel === oldName) channel = newName;
    renderChannels();
    highlight();
});

socket.on("channel-pin-update", ({ name, pinned }) => {
    if (pinned) {
        channels = channels.map(c => c.name === name ? { ...c, pinned } : c);
        channels.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
        renderChannels();
        highlight();
    } else {
        loadChannels();
    }
});

document.getElementById("search").addEventListener("input", async e => {
    const q = e.target.value.trim();

    if (!q) {
        highlight();
        load();
        return;
    }

    // remove active tab highlight while searching
    document.querySelectorAll(".channels button")
        .forEach(b => b.classList.remove("active"));

    const res = await fetch(`/search/${q}`);
    const data = await res.json();
    renderGrouped(data);
});


document.addEventListener("paste", async e => {
    const active = document.activeElement;

    // if user is typing in input, don't auto-send
    if (active && active.id === "msg") return;

    const text = e.clipboardData.getData("text");
    if (!text) return;

    await fetch("/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            content: text,
            channel,
            uploader
        })
    });
});

function uploadFile(file) {
    const status = document.getElementById("uploadStatus");
    const bar = document.getElementById("uploadBar");
    const text = document.getElementById("uploadText");

    status.style.display = "block";
    bar.style.width = "0%";
    text.innerText = "Uploading: " + file.name;

    const form = new FormData();
    form.append("file", file);
    form.append("channel", channel);
    form.append("uploader", uploader);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/upload", true);

    xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            bar.style.width = percent + "%";
        }
    };

    xhr.onload = () => {
        status.style.display = "none";
        if (xhr.status === 413) {
            alert("File too large — 2GB maximum allowed.");
            fileInput.value = "";
            return;
        }
        fileInput.value = "";
        load();
    };

    xhr.onerror = () => {
        status.style.display = "none";
        alert("Upload failed");
    };

    xhr.send(form);
}


const overlay = document.getElementById("dragOverlay");
let dragCounter = 0;

/* DRAG ENTER */
document.addEventListener("dragenter", e => {
    e.preventDefault();
    dragCounter++;
    overlay.style.display = "flex";
});

/* DRAG LEAVE */
document.addEventListener("dragleave", e => {
    dragCounter--;
    if (dragCounter <= 0) {
        overlay.style.display = "none";
        dragCounter = 0;
    }
});

document.getElementById("addChannelBtn").onclick = async () => {
    if (channels.length >= 10) { alert("Maximum 10 channels allowed"); return; }
    const name = prompt("Channel name?");
    if (!name) return;

    const res = await fetch("/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
    });

    if (!res.ok) { const err = await res.json(); alert(err.error); return; }
    await loadChannels();
};

function addChannelHandler() {
    return async () => {
        if (channels.length >= 10) { alert("Maximum 10 channels allowed"); return; }
        const name = prompt("Channel name?");
        if (!name) return;

        const res = await fetch("/channels", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name })
        });

        if (!res.ok) { const err = await res.json(); alert(err.error); return; }
        await loadChannels();
    };
}

document.getElementById("addChannelBtn").onclick = addChannelHandler();
document.getElementById("addChannelBtnDesktop").onclick = addChannelHandler();

async function loadChannels() {
    const res = await fetch("/channels");
    const data = await res.json();
    channels = data; // [{ id, name, pinned }]
    if (!channel && channels.length) channel = channels[0].name;
    renderChannels();
    highlight();
}


function renderChannels() {
    const container = document.getElementById("channels");
    container.innerHTML = "";

    channels.forEach(ch => {
        const btn = document.createElement("button");
        btn.id = "ch-" + ch.name;

        btn.onclick = (e) => {
            if (e.target.classList.contains("ch-more")) return;
            setChannel(ch.name);
        };

        btn.appendChild(document.createTextNode(ch.name));

        if (ch.pinned) {
            const dot = document.createElement("span");
            dot.className = "ch-pin-dot";
            dot.title = "Pinned — protected from deletion";
            btn.appendChild(dot);
        }

        const more = document.createElement("span");
        more.className = "ch-more";
        more.innerText = "⋯";
        more.title = "Channel options";
        more.onclick = (e) => {
            e.stopPropagation();
            showChannelMenu(e, ch);
        };
        btn.appendChild(more);

        btn.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            showChannelMenu(e, ch);
        });

        if (ch.name === channel) btn.classList.add("active");
        container.appendChild(btn);
    });

}

function showChannelMenu(e, ch) {
    const menu = document.getElementById("channelMenu");

    menu.innerHTML = `
    <button onclick="toggleChannelPin('${ch.name}')">
      ${ch.pinned ? "📍 Unpin channel" : "📌 Pin channel"}
    </button>
    <div class="menu-divider"></div>
    <button onclick="renameChannelPrompt('${ch.name}')">✎&nbsp; Rename</button>
    <button class="${ch.pinned ? "muted" : "danger"}"
      ${ch.pinned ? "" : `onclick="deleteChannel('${ch.name}')"`}>
      🗑&nbsp; Delete${ch.pinned ? " (pinned)" : ""}
    </button>
  `;

    menu.style.top = e.clientY + "px";
    menu.style.left = e.clientX + "px";
    menu.classList.add("open");

    requestAnimationFrame(() => {
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth - 8)
            menu.style.left = (e.clientX - rect.width) + "px";
        if (rect.bottom > window.innerHeight - 8)
            menu.style.top = (e.clientY - rect.height) + "px";
    });
}

document.addEventListener("click", () => {
    document.getElementById("channelMenu").classList.remove("open");
});

document.addEventListener("contextmenu", (e) => {
    if (!e.target.closest("#channels"))
        document.getElementById("channelMenu").classList.remove("open");
});

async function toggleChannelPin(name) {
    await fetch(`/channels/${name}/pin`, { method: "POST" });
}

async function renameChannelPrompt(name) {
    const newName = prompt("Rename channel to:", name);
    if (!newName || newName.trim() === name) return;

    const res = await fetch("/channels/" + name, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() })
    });

    if (!res.ok) { const err = await res.json(); alert(err.error); }
}

async function deleteChannel(name) {
    const confirmed = confirm(`Delete "${name}"? All items will be permanently removed.`);
    if (!confirmed) return;

    const res = await fetch("/channels/" + name, { method: "DELETE" });
    if (!res.ok) { const err = await res.json(); alert(err.error); }
}

/* DRAG OVER */
document.addEventListener("dragover", e => {
    e.preventDefault();
});

/* DROP ANYWHERE */
document.addEventListener("drop", async e => {
    e.preventDefault();
    overlay.style.display = "none";
    dragCounter = 0;

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const form = new FormData();
    form.append("file", file);
    form.append("channel", channel);
    form.append("uploader", uploader);

    uploadFile(file);
});

(async function init() {
    await applyBranding();
    await initName();
    const infoRes = await fetch("/info");
    const info = await infoRes.json();
    if (!info.hasAuth) {
        document.getElementById("logoutBtn").style.display = "none";
    }
    await loadChannels();
    load();
})();