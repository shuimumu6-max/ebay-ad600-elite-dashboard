// 前端逻辑自检（不需要浏览器）：把 index.html 的主脚本抽出来在 vm 里跑，
// 验证产品切片、切换器、空态与识别函数。用法：node check-frontend.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repoDir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(repoDir, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
assert.ok(scripts.length, 'index.html 里没有内联脚本');
const main = scripts.sort((a, b) => b.length - a.length)[0];

// 截掉末尾的顶层事件绑定与启动 IIFE，只保留常量与函数定义
const cut = main.indexOf("document.getElementById('fileInput').addEventListener");
assert.ok(cut > 0, '找不到脚本尾部的启动段');
const code = main.slice(0, cut);

const dataContext = vm.createContext({ window: {} });
vm.runInContext(readFileSync(join(repoDir, 'data.js'), 'utf8'), dataContext);
const bundle = dataContext.window.EBAY_PRELOADED_DATA;
assert.ok(bundle?.plgRaw?.length, 'data.js 没有预置数据');

const noop = () => {};
const context = vm.createContext({
  console,
  structuredClone,
  URLSearchParams,
  Intl,
  location: { protocol: 'http:', search: '' },
  document: {
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: () => ({ className: '', style: {}, remove: noop, appendChild: noop }),
    body: { appendChild: noop },
    documentElement: { scrollWidth: 0 }
  },
  window: { innerWidth: 1440, addEventListener: noop, EBAY_PRELOADED_DATA: bundle },
  localStorage: { getItem: () => null, setItem: noop },
  indexedDB: { open: () => ({}) },
  XLSX: {}, echarts: {}, lucide: { createIcons: noop, icons: {} },
  setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0,
  alert: noop, confirm: () => false, requestAnimationFrame: noop
});
vm.runInContext(code + '\n;globalThis.__api = { get ui(){return ui}, setUiProduct(v){ui.product=v}, get fullState(){return fullState}, get dataState(){return dataState}, setFullState(v){fullState=v}, applyProduct, productOf, inProduct, productNotice, productSwitch, productOptions, PRODUCTS, PRODUCT_ALL, PRODUCT_UNKNOWN };', context);
const api = context.__api;

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  PASS  ${name}`); }

console.log('前端逻辑自检（无浏览器）');

api.setFullState({
  plgRaw: bundle.plgRaw,
  trafficRaw: bundle.trafficRaw,
  activeListings: bundle.activeListings,
  sources: bundle.sources,
  ads: bundle.ads,
  products: bundle.products,
  productCounts: bundle.productCounts
});

ok('默认「全部」视图包含两个产品且行数不变', () => {
  api.setUiProduct('all');
  api.applyProduct();
  const products = [...new Set([...api.dataState.plgRaw, ...api.dataState.trafficRaw].map(row => row.product))].sort();
  assert.deepEqual(products, ['AD600 Elite', 'UltraDiag900 E']);
  assert.equal(api.dataState.plgRaw.length, bundle.plgRaw.length);
  assert.equal(api.dataState.trafficRaw.length, bundle.trafficRaw.length);
});

ok('切到 900E：只保留 900E 行，广告数据置空', () => {
  api.setUiProduct('UltraDiag900 E');
  api.applyProduct();
  assert.ok(api.dataState.plgRaw.length > 0 && api.dataState.trafficRaw.length > 0);
  assert.ok([...api.dataState.plgRaw, ...api.dataState.trafficRaw].every(row => row.product === 'UltraDiag900 E'));
  assert.ok((api.dataState.activeListings?.items || []).every(row => row.product === 'UltraDiag900 E'));
  assert.equal((api.dataState.ads.plpRows || []).length, 0);
  assert.equal((api.dataState.ads.keywordRows || []).length, 0);
  assert.equal((api.dataState.ads.searchRows || []).length, 0);
});

ok('900E 显示广告数据空态提示', () => {
  const notice = api.productNotice();
  assert.ok(notice.includes('暂无 PLP'), `空态提示内容不对：${notice}`);
  assert.ok(notice.includes('UltraDiag900 E'));
});

ok('切到 600E：只保留 600E 行，广告数据保留', () => {
  api.setUiProduct('AD600 Elite');
  api.applyProduct();
  assert.ok([...api.dataState.plgRaw, ...api.dataState.trafficRaw].every(row => row.product === 'AD600 Elite'));
  assert.ok((api.dataState.ads.plpRows || []).length > 0, '600E 的 PLP 数据被误清空');
  assert.equal(api.productNotice(), '', '600E 不应显示空态提示');
});

ok('切回「全部」后数据完整恢复', () => {
  api.setUiProduct('all');
  api.applyProduct();
  assert.equal(api.dataState.plgRaw.length, bundle.plgRaw.length);
  assert.equal(api.dataState.trafficRaw.length, bundle.trafficRaw.length);
  assert.equal(api.productNotice(), '');
});

ok('产品切换器恰好三档且顺序固定', () => {
  // vm 里的数组跨 realm，用 JSON 比较而非 deepStrictEqual
  assert.equal(JSON.stringify(api.productOptions().map(([key]) => key)), JSON.stringify(['all', 'AD600 Elite', 'UltraDiag900 E']));
  const markup = api.productSwitch();
  assert.equal((markup.match(/data-product=/g) || []).length, 3);
  assert.ok(markup.includes('class="product-btn active"'));
});

ok('识别函数与构建端口径一致', () => {
  assert.equal(api.productOf({ title: 'TOPDON ArtiDiag600 Elite OBD2 Scanner' }), 'AD600 Elite');
  assert.equal(api.productOf({ title: '🔥TOPDON UD900E Lifetime Free Updates' }), 'UltraDiag900 E');
  assert.equal(api.productOf({ title: 'NEW TOPDON ONE Lite OBD2 Scanner' }), 'unknown');
  api.setUiProduct('UltraDiag900 E');
  assert.equal(api.inProduct({ title: 'TOPDON AD600Elite Scanner' }), false);
  assert.equal(api.inProduct({ title: 'TOPDON UltraDiag900 E Scanner' }), true);
  api.setUiProduct('all');
  assert.equal(api.inProduct({ title: 'TOPDON AD600Elite Scanner' }), true);
});

ok('所有预置数据行都带合法 product', () => {
  const rows = [...bundle.plgRaw, ...bundle.trafficRaw, ...bundle.ads.plpRows, ...(bundle.activeListings?.items || [])];
  assert.ok(rows.length > 0);
  assert.ok(rows.every(row => api.PRODUCTS.some(product => product.key === row.product)));
});

console.log(`\n全部通过：${passed} 项`);
