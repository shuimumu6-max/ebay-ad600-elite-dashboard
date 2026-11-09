// 双产品看板自检：产品常量一致性、识别口径、真实数据完整性、前端改造点。
// 用法：node check-products.mjs  （可传 --dir <CSV目录> 覆盖数据源）
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PRODUCTS, PRODUCT_UNKNOWN, productOf, buildBundleFromDirectory } from './update-dashboard.mjs';

const repoDir = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(repoDir, '..');
const htmlPath = join(sourceRoot, 'ebay-traffic-dashboard/ebay-traffic-dashboard.html');
const builderPath = join(repoDir, 'update-dashboard.mjs');
const arg = process.argv.indexOf('--dir');
const dataDir = arg >= 0 ? resolve(process.argv[arg + 1]) : resolve(sourceRoot, '..');

let passed = 0;
function ok(name, fn) {
  fn();
  passed += 1;
  console.log(`  PASS  ${name}`);
}

// 取出两处 PRODUCTS 数组字面量（忽略缩进和 export 关键字差异，只比内容）
function productsLiteral(text) {
  const begin = text.indexOf('// === PRODUCTS-BEGIN');
  const end = text.indexOf('// === PRODUCTS-END ===');
  assert.ok(begin >= 0 && end > begin, '缺少 PRODUCTS 标记块');
  const block = text.slice(begin, end);
  const match = block.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  assert.ok(match, 'PRODUCTS 标记块里找不到数组字面量');
  return match[0].replace(/\s+/g, '');
}

console.log('双产品看板自检');
console.log(`数据源：${dataDir}`);

ok('两处 PRODUCTS 常量逐字一致（归一化空白后）', () => {
  const builder = productsLiteral(readFileSync(builderPath, 'utf8'));
  const html = productsLiteral(readFileSync(htmlPath, 'utf8'));
  assert.equal(builder, html, 'update-dashboard.mjs 与 ebay-traffic-dashboard.html 的 PRODUCTS 不一致');
});

ok('产品清单恰好两个，SKU 为 TD52110512 / TD52110602', () => {
  assert.equal(PRODUCTS.length, 2);
  assert.deepEqual(PRODUCTS.map(p => p.key), ['AD600 Elite', 'UltraDiag900 E']);
  assert.deepEqual(PRODUCTS.map(p => p.sku), ['TD52110512', 'TD52110602']);
});

ok('标题 token 覆盖 600E / 900E 的实际写法', () => {
  const cases = [
    ['TOPDON ArtiDiag600 Elite OBD2 Scanner', 'AD600 Elite'],
    ['2026 NEW🔥TOPDON AD600 Elite Full System OBD2 Scanner', 'AD600 Elite'],
    ['TOPDON AD600Elite OBD2 Scanner Lifetime Free Updates', 'AD600 Elite'],
    ['TOPDN ArtiDiag600 Elite Car Diagnostic Scanner', 'AD600 Elite'],
    ['🔥Free lifetime Updates TOPDON UltraDiag900 E Car Diagnostic Scanner 39+Service', 'UltraDiag900 E'],
    ['🔥TOPDON UD900E Lifetime Free Updates 39+ Resets OBD2 Scanner', 'UltraDiag900 E'],
    ['TOPDON UltraDiag900E Bidirectional Scan Tool', 'UltraDiag900 E']
  ];
  for (const [title, expected] of cases) {
    assert.equal(productOf({ title }), expected, `标题识别错误：${title}`);
  }
});

ok('SKU 兜底在在售名单快照上生效（allowSku 默认开启）', () => {
  const skuMap = new Map([['820312885720', 'td52110602'], ['820236953683', 'td52110512']]);
  assert.equal(productOf({ itemId: '820312885720', title: 'Diagnostic Scanner' }, skuMap), 'UltraDiag900 E');
  assert.equal(productOf({ itemId: '820236953683', title: 'Diagnostic Scanner' }, skuMap), 'AD600 Elite');
});

ok('SKU 不会倒推历史流量行（链接复用场景）', () => {
  // 820289759002 在 11-04 在售名单是 ONE Lite (TD52110549)，11-06 换成 900E (TD52110602)。
  // 历史 Traffic 行的标题是 ONE Lite，按报表当时信息判定应落在 unknown，不算进任何产品。
  const skuMap = new Map([['820289759002', 'td52110602']]);
  const row = { itemId: '820289759002', title: 'NEW TOPDON ONE Lite OBD2 Scanner, Bidirectional Car Diagnostic Tool, ECU Coding' };
  assert.equal(productOf(row, skuMap, { allowSku: false }), PRODUCT_UNKNOWN);
  assert.equal(productOf({ ...row, title: '🔥TOPDON UD900E Lifetime Free Updates 39+ Resets' }, skuMap, { allowSku: false }), 'UltraDiag900 E');
});

ok('campaign 名兜底识别产品', () => {
  assert.equal(productOf({ title: 'TOPDON Car Diagnostic Tool', campaign: 'US.TD.PLG.UD900E.管培.核心' }, new Map(), { allowSku: false }), 'UltraDiag900 E');
  assert.equal(productOf({ title: 'TOPDON Car Diagnostic Tool', campaign: 'US.TD.PLG.AD600.Elite' }, new Map(), { allowSku: false }), 'AD600 Elite');
});

ok('非目标产品不会被识别', () => {
  assert.equal(productOf({ title: 'TOPDON Phoenix Lite 2 Scanner' }), PRODUCT_UNKNOWN);
  assert.equal(productOf({ title: 'NEW TOPDON ONE Lite OBD2 Scanner' }), PRODUCT_UNKNOWN);
});

const html = readFileSync(htmlPath, 'utf8');
ok('前端已接入产品切换器与视图切片', () => {
  for (const needle of ['function applyProduct()', 'function productSwitch()', 'function productNotice()', 'data-product=', 'let fullState', 'dataState = structuredClone(fullState)', '.put(fullState, DB_KEY)']) {
    assert.ok(html.includes(needle), `前端缺少：${needle}`);
  }
});
ok('前端 12 处旧单产品过滤已替换', () => {
  assert.ok(!html.includes('isTargetModelTitle(row.title)'), '仍有 isTargetModelTitle(row.title) 调用');
  assert.ok(html.includes('function isTargetModelTitle(value)'), '兼容别名被误删');
  assert.ok(!html.includes("normalized.includes('artidiag600elite')"), '旧单产品闸门仍在');
});

if (existsSync(dataDir)) {
  const bundle = buildBundleFromDirectory(dataDir);
  ok('bundleId 使用双产品前缀', () => assert.match(bundle.bundleId, /^dual-product-v1-[a-f0-9]{16}$/));
  ok('两个产品都有数据，且没有 unknown 行', () => {
    assert.ok(bundle.productCounts['AD600 Elite'] > 0, 'AD600 Elite 无数据');
    assert.ok(bundle.productCounts['UltraDiag900 E'] > 0, 'UltraDiag900 E 无数据');
    assert.equal(bundle.productCounts[PRODUCT_UNKNOWN], 0);
  });
  // 基线来源：2026-11-09 用改造前 update-dashboard.mjs 跑同一目录，
  // 600E = plg 3239 + traffic 4489 + active 80 + plp 242 = 8050 行。
  ok('600E 历史数据一行未少（改造前基线 8050 行）', () => {
    assert.ok(bundle.productCounts['AD600 Elite'] >= 8050, `600E 只有 ${bundle.productCounts['AD600 Elite']} 行，疑似丢数据`);
  });
  ok('900E 的 PLG / Traffic / 在售名单都有行', () => {
    assert.ok(bundle.plgRaw.some(row => row.product === 'UltraDiag900 E'));
    assert.ok(bundle.trafficRaw.some(row => row.product === 'UltraDiag900 E'));
    assert.ok((bundle.activeListings?.items || []).some(row => row.product === 'UltraDiag900 E'));
  });
  ok('每一行都带 product 字段', () => {
    const rows = [...bundle.plgRaw, ...bundle.trafficRaw, ...bundle.adImports.plpRows, ...(bundle.activeListings?.items || [])];
    assert.ok(rows.length > 0);
    assert.ok(rows.every(row => PRODUCTS.some(p => p.key === row.product)), '存在未打产品标签的行');
  });
  ok('ONE Lite 历史行未被错算成 900E', () => {
    const wrong = [...bundle.plgRaw, ...bundle.trafficRaw].filter(row => row.product === 'UltraDiag900 E' && /ONE Lite/i.test(row.title));
    assert.equal(wrong.length, 0, `有 ${wrong.length} 行 ONE Lite 被误判为 900E`);
  });
  console.log(`  数据分布：${PRODUCTS.map(p => `${p.label} ${bundle.productCounts[p.key]} 行`).join('，')}`);
} else {
  console.log(`  SKIP  真实数据目录不存在：${dataDir}`);
}

console.log(`\n全部通过：${passed} 项`);
