# QR Code Studio

A static QR code generator. GitHub Pages builds the Tailwind stylesheet and publishes the site files; the app itself runs entirely in the browser.

## Deploy to GitHub Pages

1. Push this project to a GitHub repository, with `index.html` at the repository root.
2. In the repository, open **Settings > Pages** and set **Build and deployment** to **GitHub Actions**.
3. Push to the `main` branch, or run **Deploy to GitHub Pages** from the **Actions** tab using **Run workflow**.
4. When the workflow completes, open the site URL shown in the deployment summary.

The workflow runs on pushes to `main`. If your default branch has another name, change the branch under `on.push.branches` in `.github/workflows/pages.yml` to match it.

## Test locally

Build the stylesheet, then start a local server from the project root:

```sh
npm ci
npm run build
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The page loads its CSS and JavaScript from relative paths, so it works under both a repository Pages URL and a custom domain.

Font Awesome, QRCode.js, and Google Fonts load from CDNs and need an internet connection. QRCode.js is pinned with a Subresource Integrity hash. Tailwind is compiled locally during the Pages workflow, so its styling does not depend on the Tailwind CDN.# QR-code-generator
