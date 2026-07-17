import { execFileSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { resolve } from 'node:path';

const [, , sourceArgument, outputArgument = 'public/regions/SIG-20260701.json'] = process.argv;

if (!sourceArgument) {
  throw new Error('사용법: npm run regions:build -- <HangJeongDong_ver20260701.geojson 경로> [출력 경로]');
}

const sourcePath = resolve(sourceArgument);
const outputPath = resolve(outputArgument);

accessSync(sourcePath, constants.R_OK);

execFileSync(
  resolve('node_modules/.bin/mapshaper'),
  [
    sourcePath,
    '-dissolve',
    'sgg',
    'copy-fields=sido,sggnm',
    '-simplify',
    '18.7%',
    'keep-shapes',
    '-rename-fields',
    'SIG_CD=sgg,SIG_KOR_NM=sggnm',
    '-filter-fields',
    'SIG_CD,SIG_KOR_NM,sido',
    '-o',
    'format=geojson',
    'precision=0.000001',
    outputPath,
  ],
  { stdio: 'inherit' },
);
