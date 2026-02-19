```{=html}
<p align="center">
```
`<img src="/client/assets/logo.png" alt="Instbyte Logo" width="120" />`{=html}
```{=html}
</p>
```
# Instbyte

**Instbyte** is a high-speed, real-time ephemeral sharing utility
designed for teams and developers who need to move snippets, links, and
files across devices and colleagues without the friction of traditional
communication tools.

Built for efficiency, it serves as a "digital dead-drop" that lives on
your local network, ensuring that your data is shared instantly and
purged automatically.

------------------------------------------------------------------------

## Core Features

-   **Real-Time Sync**\
    Every action (clipboard paste, file drop, or text snippet) is
    instantly broadcast to all connected team members.

-   **Zero-Friction Sharing**

    -   **Paste Anywhere**: Copy text/links and paste directly onto the
        page to share.
    -   **Drag & Drop**: Drop files anywhere on the interface to upload
        instantly.
    -   **Quick Upload Button**: Manual file picker available when
        needed.

-   **Contextual Channels** Organize transfers by project or team (e.g.,
    General, Projects, Assets, Temp).\
    Create or remove channels dynamically with automatic sync across
    connected users.

-   **Searchable History** Lightning-fast full-text search across all
    channels.

-   **Ephemeral by Design** A background cleanup process automatically
    deletes shared content after 24 hours.

-   **LAN Optimized** Designed to operate seamlessly within a local
    network for office environments, labs, or home setups.

-   **Smart Port Handling** Automatically switches to the next
    available port if `3000` is already in use.

-   **Improved Upload Validation** File size rules with clearer visual
    indicators for better reliability and feedback.

------------------------------------------------------------------------

## Getting Started

1.  **Install Dependencies**

    ``` bash
    npm install
    ```

2.  **Start the Server**

    ``` bash
    node server.js
    ```

3.  **Access the App**

    -   Local: `http://localhost:<port>`
    -   Network: Use the displayed LAN IP to share with teammates

4.  **Share Instantly** Type, paste, drag, or upload. Done.

------------------------------------------------------------------------

## 🛠 Use Cases

-   **Sprint Collaboration**\
    Quickly swap API payloads or UI screenshots during pairing sessions.

-   **Cross-Platform Bridge**\
    Move a URL from your Android/iOS phone to your Linux/Windows
    workstation without emailing yourself.

-   **Temporary Asset Exchange**\
    Share logs, screenshots, or small assets that only need short-lived
    availability.

-   **Local Team Coordination**\
    Use channels to isolate project-specific exchanges.

------------------------------------------------------------------------

## Versioning

Instbyte follows semantic versioning:

-   **MAJOR** -- Breaking changes\
-   **MINOR** -- New features & improvements\
-   **PATCH** -- Bug fixes

See the GitHub Releases section for detailed release notes.

------------------------------------------------------------------------

## Contributing

Contributions are welcome.

If you're interested in extending functionality---such as encryption,
configurable persistence windows, authentication layers, or UI
themes---feel free to open an issue or submit a pull request.

------------------------------------------------------------------------

## License

This project is licensed under the MIT License --- see the
[LICENSE](LICENSE) file for details.
