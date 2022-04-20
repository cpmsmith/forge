/**
 * Mixing glue with lint is probably something you never want to do in real
 * life, but in this project it helps the linter do its job.
 *
 * This script creates `index.ts` files in each package directory that simply
 * re-export the exports of the real main file. Not fully sure why this fixes
 * things or why the linter plugins for dependencies need this, but hey I'm just
 * trying to glue some lint here.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { getPackageInfo } from './utils';

// NOTE: this interface only defines the fields in the package.json that are
// used in this script
interface PartialPackageManifest {
  main?: string;
}

/**
 * A heuristic to convert the `main` value from the package.json from its output
 * location to the source location (e.g. dist/ to src/ & .js to .ts).
 */
function convertMainToSrc(main: string): string {
  return main.replace(/^dist\//, 'src/').replace(/\.js$/, '.ts');
}

(async () => {
  const pkgs = await getPackageInfo();

  // Run each package in parallel
  await Promise.all(
    pkgs.map(async (pkg) => {
      // Extract the `main` field from the package.json
      const { main } = pkg.manifest as PartialPackageManifest;

      // Skip packages that have no main (e.g. the cli as of writing)
      if (main === undefined) {
        return;
      }

      // Read the main file
      const srcMain = path.resolve(pkg.path, convertMainToSrc(main));
      const srcMainContents = await fs.readFile(srcMain, { encoding: 'utf8' });

      // Detect if the package has a default export
      const hasDefault = /export\s+default/i.test(srcMainContents);

      // Write the facade entry-point file
      const importTarget = srcMain.replace(/\.ts$/, '');
      const facadeFilePath = path.resolve(pkg.path, 'index.ts');
      let facadeFileContents = `export * from "${importTarget}";\n`;
      if (hasDefault) {
        facadeFileContents += `import defaultExport from "${importTarget}";\n` + `export default defaultExport;\n`;
      }
      await fs.writeFile(facadeFilePath, facadeFileContents);
    })
  );
})().catch(console.error);
