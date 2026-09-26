// 共通パーツ同期ツール（ビルド不要・依存なし）
//
// 使い方（coreworks-site 直下で）:
//   node _tools/sync.mjs          … _partials/*.html を全ページへ反映
//   node _tools/sync.mjs --check  … 反映漏れがあれば一覧を出して終了コード1
//
// ページ側には次の目印を書いておく（中身はこのツールが上書きする）:
//   <!--#header--><!--/header-->
//   <!--#footer--><!--/footer-->
// 目印の名前 = _partials/ のファイル名。表示中ページへのリンクには aria-current="page" を付ける。
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const check = process.argv.includes("--check");

function htmlFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name.startsWith("_") || e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...htmlFiles(p));
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

// ファイルパス → 公開URLのパス（/, /koji/, /cases/x.html）
function urlPath(file) {
  const rel = "/" + relative(root, file).split(sep).join("/");
  return rel.replace(/index\.html$/, "");
}

function partial(name) {
  const p = join(root, "_partials", name + ".html");
  return existsSync(p) ? readFileSync(p, "utf8").trim() : null;
}

const marker = /<!--#([\w-]+)-->[\s\S]*?<!--\/\1-->/g;
const stale = [];
let updated = 0;

for (const file of htmlFiles(root)) {
  const src = readFileSync(file, "utf8");
  const here = urlPath(file);
  const next = src.replace(marker, (whole, name) => {
    let body = partial(name);
    if (body === null) {
      console.warn(`! ${relative(root, file)}: _partials/${name}.html がありません`);
      return whole;
    }
    body = body.split(`href="${here}"`).join(`href="${here}" aria-current="page"`);
    return `<!--#${name}-->\n${body}\n<!--/${name}-->`;
  });
  if (next === src) continue;
  if (check) stale.push(relative(root, file));
  else { writeFileSync(file, next); updated++; console.log(`更新: ${relative(root, file)}`); }
}

if (check) {
  if (stale.length) { console.log("未反映:\n  " + stale.join("\n  ")); process.exit(1); }
  console.log("すべて最新です");
} else {
  console.log(updated ? `${updated} ファイルを更新しました` : "変更はありません");
}
