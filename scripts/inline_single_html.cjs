const fs = require('fs');
const path = require('path');

function main() {
  const root = process.cwd();
  // 兼容两种构建输出：dist/static 与 dist
  let distDir = path.join(root, 'dist', 'static');
  let indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    distDir = path.join(root, 'dist');
    indexPath = path.join(distDir, 'index.html');
  }
  if (!fs.existsSync(indexPath)) {
    console.error('dist/static/index.html 或 dist/index.html 未找到，请先构建。');
    process.exit(1);
  }

  let html = fs.readFileSync(indexPath, 'utf-8');

  // Remove modulepreload links to avoid external asset requests
  html = html.replace(/<link[^>]+rel="modulepreload"[^>]*>/g, '');

  // Target only the built asset stylesheet link
  const cssHrefMatch = html.match(/<link[^>]+rel="stylesheet"[^>]*href="([^"]*assets[^"]+)"[^>]*>/);
  const jsSrcMatch = html.match(/<script[^>]+type="module"[^>]*src="([^"]+)"[^>]*><\/script>/);

  const cssHref = cssHrefMatch ? cssHrefMatch[1] : null;
  const jsSrc = jsSrcMatch ? jsSrcMatch[1] : null;

  function resolveAsset(p) {
    if (!p) return null;
    return p.startsWith('/')
      ? path.join(distDir, p.slice(1))
      : path.join(distDir, p);
  }

  const cssPath = resolveAsset(cssHref);
  const jsPath = resolveAsset(jsSrc);

  const css = cssPath && fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf-8') : '';
  const js = jsPath && fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf-8') : '';

  if (css) {
    html = html.replace(cssHrefMatch[0], `<style>\n${css}\n</style>`);
    // Remove any remaining stylesheet links to built assets
    html = html.replace(/<link[^>]+rel="stylesheet"[^>]*href="[^"]*assets[^"]+"[^>]*>/g, '');
  }

  if (js) {
    const jsBase64 = Buffer.from(js, 'utf-8').toString('base64');
    html = html.replace(jsSrcMatch[0], `<script type="module" src="data:text/javascript;base64,${jsBase64}"></script>`);
  }

  const outDir = path.join(root, 'apsd');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'index.html');
  fs.writeFileSync(outPath, html);
  console.log('Wrote single-file HTML to', outPath);
}

main();