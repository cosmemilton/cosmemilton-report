// Gera o CSS publicado a partir dos partials em src/styles/.
//
// Tudo é embrulhado em @layer cm.report — CSS sem layer do consumidor sempre
// vence, então sobrescrever um estilo do editor nunca exige guerra de
// especificidade (mesmo padrão do cosmemilton-ui).
//
// Partials numerados (NN-*.css) preservam a ordem da cascata via sort lexical.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";
import postcss from "postcss";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const stylesDir = join(root, "src", "styles");
const distDir = join(root, "dist");

const partials = (await readdir(stylesDir)).filter((name) => name.endsWith(".css")).sort();
const css =
  "@layer cm.report;\n@layer cm.report {\n" +
  (await Promise.all(partials.map((name) => readFile(join(stylesDir, name), "utf8")))).join("") +
  "}\n";

const prettyPipeline = postcss([autoprefixer]);
const minPipeline = postcss([autoprefixer, cssnano]);

await mkdir(distDir, { recursive: true });
const pretty = await prettyPipeline.process(css, { from: undefined });
await writeFile(join(distDir, "styles.css"), pretty.css);
const min = await minPipeline.process(css, { from: undefined });
await writeFile(join(distDir, "styles.min.css"), min.css);
console.log(
  `build-styles: styles.css ${(pretty.css.length / 1024).toFixed(1)}kB · ` +
    `styles.min.css ${(min.css.length / 1024).toFixed(1)}kB`,
);
