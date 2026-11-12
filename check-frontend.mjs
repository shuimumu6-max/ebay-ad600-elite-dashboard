// 前端逻辑自检（不需要浏览器）：把 index.html 的主脚本抽出来在 vm 里跑，
// 验证产品切片、切换器、空态与识别函数。用法：node check-frontend.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
vm.runInContext(code + '\n;globalThis.__api = { get ui(){return ui}, setUiProduct(v){ui.product=v}, get fullState(){return fullState}, get dataState(){return dataState}, setFullState(v){fullState=v}, applyProduct, productOf, inProduct, productNotice, productSwitch, productOptions, trafficSelection, itemPerformance, PRODUCTS, PRODUCT_ALL, PRODUCT_UNKNOWN };', context);
const api = context.__api;

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  PASS  ${name}`); }

console.log('前端逻辑自检（无浏览器）');

api.setFullState({
  plgRaw: bundle.plgRaw,
  trafficRaw: bundle.trafficRaw,
  itemHistory: bundle.itemHistory,
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

ok('换品检测：11-01~11-08 快照标注 ONE Lite 前身链接且不改动数值', () => {
  api.setUiProduct('UltraDiag900 E');
  api.applyProduct();
  assert.ok(api.dataState.itemHistory && Object.keys(api.dataState.itemHistory).length > 0, 'itemHistory 没有透传到产品视图');
  api.ui.start = '2026-11-01';
  api.ui.end = '2026-11-08';
  api.ui.trafficSource = 'snapshot';
  const selection = api.trafficSelection();
  const ids = (selection.swaps || []).map(swap => swap.itemId);
  assert.ok(ids.includes('820289759002') && ids.includes('820289778048'), `swaps 检出不对：${ids.join(',') || '（空）'}`);
  assert.ok((selection.note || '').includes('换过标题/商品'), '对账文案缺换品提示');
  const swap = selection.swaps.find(entry => entry.itemId === '820289759002');
  assert.ok(swap.foreign.length > 0, '换品链接缺前身标题证据');
  assert.ok(swap.foreign.some(h => h.p === null && (h.t || '').includes('ONE Lite')), '前身标题应为非目标产品（ONE Lite）');
  // 历史值不剔除：快照行曝光保持原始累计值（远大于日报相加）
  const row = selection.rows.find(entry => entry.itemId === '820289759002');
  assert.ok(Number(row.totalImpressions) > swap.dailyImp, `快照值被错误改动：${row.totalImpressions}`);
  api.ui.start = '';
  api.ui.end = '';
  api.setUiProduct('all');
  api.applyProduct();
});

ok('换品销量剔除：快照销量改用本体时期日报合计，剔除量留痕', () => {
  const mk = over => ({ title: '🔥TOPDON UD900E Lifetime Free Updates', product: 'UltraDiag900 E', itemId: '999999999999',
    campaign: 'C', campaignId: '1', totalImpressions: 0, totalPageViews: 0, quantitySold: 0,
    top20Promoted: 0, top20Organic: 0, restSearch: 0, totalSearch: 0, nonSearchPromoted: 0, nonSearchOrganic: 0,
    promotedEbayImpressions: 0, promotedOffsiteImpressions: 0, organicEbayImpressions: 0,
    promotedEbayViews: 0, promotedExternalViews: 0, organicEbayViews: 0, organicExternalViews: 0, ...over });
  api.setFullState({
    plgRaw: [{ key: 'k', itemId: '1', date: '2026-11-01', title: 't', product: 'AD600 Elite', campaign: 'C', campaignId: '1',
      price: 0, priceAt: '2026-11-01T00:00:00.000Z', adImpressions: 0, adClicks: 0, adSold: 0, organicSold: 0, totalSold: 0, adSales: 0, adFees: 0 }],
    trafficRaw: [
      // 区间快照：销量 5 含 ONE Lite 时期出单（本体时期从 11-06 起）
      mk({ start: '2026-11-01', end: '2026-11-08', totalImpressions: 9000, totalPageViews: 500, quantitySold: 5 }),
      mk({ start: '2026-11-06', end: '2026-11-06', totalImpressions: 100, totalPageViews: 8 }),
      mk({ start: '2026-11-07', end: '2026-11-07', totalImpressions: 110, totalPageViews: 9 }),
      mk({ start: '2026-11-08', end: '2026-11-08', totalImpressions: 120, totalPageViews: 10 })
    ],
    itemHistory: { '999999999999': [
      { t: 'NEW TOPDON ONE Lite OBD2 Scanner', p: null, f: '2026-11-01', l: '2026-11-05', n: 5 },
      { t: '🔥TOPDON UD900E Lifetime Free Updates', p: 'UltraDiag900 E', f: '2026-11-06', l: '2026-11-08', n: 3 }
    ] },
    activeListings: null, sources: [],
    ads: { plpRows: [], keywordRows: [], searchRows: [] },
    products: api.PRODUCTS, productCounts: null
  });
  api.setUiProduct('all');
  api.ui.start = '2026-11-01';
  api.ui.end = '2026-11-08';
  api.ui.trafficSource = 'snapshot';
  api.applyProduct();
  const selection = api.trafficSelection();
  const row = selection.rows.find(entry => entry.itemId === '999999999999');
  assert.equal(row.quantitySold, 0, `快照销量应剔除为本体时期 0，实际 ${row.quantitySold}`);
  assert.equal(row.soldRaw, 5, '原始快照销量应保留在 soldRaw');
  assert.equal(row.soldExcluded, 5, '剔除量应为 5');
  assert.ok((selection.note || '').includes('剔除非本体时期的出单'), '对账文案缺销量剔除说明');
  // 覆盖不全：撤掉 11-07 日报 → 暂按已覆盖日报剔除（0）并标注不确定
  api.dataState.trafficRaw = api.dataState.trafficRaw.filter(r => r.start !== '2026-11-07');
  const selection2 = api.trafficSelection();
  const row2 = selection2.rows.find(entry => entry.itemId === '999999999999');
  assert.equal(row2.quantitySold, 0, `覆盖不全时应按已覆盖日报剔除（0），实际 ${row2.quantitySold}`);
  assert.equal(row2.soldUncertain, true, '覆盖不全应标注 soldUncertain');
  assert.equal(row2.soldRaw, 5, '覆盖不全时原始快照销量仍应留痕');
  api.ui.start = '';
  api.ui.end = '';
  api.setUiProduct('all');
  api.applyProduct();
});

ok('同产品改标题不算换品：本体旧标题下的真实出单不被误剔', () => {
  const mk = over => ({ title: '🔥TOPDON AD600 Elite OBD2 Scanner Full System', product: 'AD600 Elite', itemId: '888888888888',
    campaign: 'C', campaignId: '1', totalImpressions: 0, totalPageViews: 0, quantitySold: 0,
    top20Promoted: 0, top20Organic: 0, restSearch: 0, totalSearch: 0, nonSearchPromoted: 0, nonSearchOrganic: 0,
    promotedEbayImpressions: 0, promotedOffsiteImpressions: 0, organicEbayImpressions: 0,
    promotedEbayViews: 0, promotedExternalViews: 0, organicEbayViews: 0, organicExternalViews: 0, ...over });
  api.setFullState({
    plgRaw: [{ key: 'k', itemId: '1', date: '2026-11-01', title: 't', product: 'AD600 Elite', campaign: 'C', campaignId: '1',
      price: 0, priceAt: '2026-11-01T00:00:00.000Z', adImpressions: 0, adClicks: 0, adSold: 0, organicSold: 0, totalSold: 0, adSales: 0, adFees: 0 }],
    trafficRaw: [
      mk({ start: '2026-11-01', end: '2026-11-08', totalImpressions: 9000, totalPageViews: 500, quantitySold: 1 }),
      mk({ start: '2026-11-06', end: '2026-11-06', totalImpressions: 100, totalPageViews: 8 })
    ],
    itemHistory: { '888888888888': [
      // 两个标题都是 AD600 Elite——只是改写文案，绝不能把旧标题时期当前身
      { t: 'TOPDON AD600Elite OBD2 Scanner Lifetime Free Updates', p: 'AD600 Elite', f: '2026-07-25', l: '2026-11-06', n: 293 },
      { t: '🔥TOPDON AD600 Elite OBD2 Scanner Full System', p: 'AD600 Elite', f: '2026-09-25', l: '2026-11-11', n: 58 }
    ] },
    activeListings: null, sources: [],
    ads: { plpRows: [], keywordRows: [], searchRows: [] },
    products: api.PRODUCTS, productCounts: null
  });
  api.setUiProduct('AD600 Elite');
  api.ui.start = '2026-11-01';
  api.ui.end = '2026-11-08';
  api.ui.trafficSource = 'snapshot';
  api.applyProduct();
  const selection = api.trafficSelection();
  const row = selection.rows.find(entry => entry.itemId === '888888888888');
  assert.equal(row.quantitySold, 1, `同产品改标题不应剔除销量，实际 ${row.quantitySold}`);
  assert.ok(row.soldExcluded == null, '不应产生剔除量');
  assert.ok(!row.soldUncertain, '不应标注不确定');
  api.ui.start = '';
  api.ui.end = '';
  api.setUiProduct('all');
  api.applyProduct();
});

ok('窗口整体落在前身时期：快照销量全部剔除为本体 0', () => {
  const mk = over => ({ title: '🔥TOPDON UD900E Lifetime Free Updates', product: 'UltraDiag900 E', itemId: '777777777777',
    campaign: 'C', campaignId: '1', totalImpressions: 0, totalPageViews: 0, quantitySold: 0,
    top20Promoted: 0, top20Organic: 0, restSearch: 0, totalSearch: 0, nonSearchPromoted: 0, nonSearchOrganic: 0,
    promotedEbayImpressions: 0, promotedOffsiteImpressions: 0, organicEbayImpressions: 0,
    promotedEbayViews: 0, promotedExternalViews: 0, organicEbayViews: 0, organicExternalViews: 0, ...over });
  api.setFullState({
    plgRaw: [{ key: 'k', itemId: '1', date: '2026-11-01', title: 't', product: 'AD600 Elite', campaign: 'C', campaignId: '1',
      price: 0, priceAt: '2026-11-01T00:00:00.000Z', adImpressions: 0, adClicks: 0, adSold: 0, organicSold: 0, totalSold: 0, adSales: 0, adFees: 0 }],
    trafficRaw: [
      // 窗口 11-01~11-03 整体在前身时期（前身最晚 11-04，本体 11-05 起）
      mk({ start: '2026-11-01', end: '2026-11-03', totalImpressions: 9000, totalPageViews: 500, quantitySold: 2 })
    ],
    itemHistory: { '777777777777': [
      { t: 'NEW TOPDON ONE Lite OBD2 Scanner', p: null, f: '2026-11-01', l: '2026-11-04', n: 4 },
      { t: '🔥TOPDON UD900E Lifetime Free Updates', p: 'UltraDiag900 E', f: '2026-11-05', l: '2026-11-08', n: 3 }
    ] },
    activeListings: null, sources: [],
    ads: { plpRows: [], keywordRows: [], searchRows: [] },
    products: api.PRODUCTS, productCounts: null
  });
  api.setUiProduct('UltraDiag900 E');
  api.ui.start = '2026-11-01';
  api.ui.end = '2026-11-03';
  api.ui.trafficSource = 'snapshot';
  api.applyProduct();
  const selection = api.trafficSelection();
  const row = selection.rows.find(entry => entry.itemId === '777777777777');
  assert.equal(row.quantitySold, 0, `整窗前身时期销量应剔为 0，实际 ${row.quantitySold}`);
  assert.equal(row.soldExcluded, 2, '剔除量应为 2');
  api.ui.start = '';
  api.ui.end = '';
  api.setUiProduct('all');
  api.applyProduct();
});

ok('售价取「最新一次导出」的当前价，与行序无关', () => {
  // eBay 的 Price (Current or Last Price) 是导出时点快照：旧快照 245、新快照 229。
  // 这里故意把旧快照排在最后一行——若按遍历顺序取价会显示 245，正确结果必须是 229。
  const base = { title: 'TOPDON AD600 Elite OBD2 Scanner', product: 'AD600 Elite', campaign: 'C1', campaignId: '1',
    adImpressions: 0, adClicks: 0, adSold: 0, organicSold: 0, totalSold: 0, adSales: 0, adFees: 0 };
  api.setFullState({
    plgRaw: [
      { ...base, key: 'k1', itemId: '111111111111', date: '2026-11-09', price: 229, priceAt: '2026-11-10T12:17:00.000Z' },
      { ...base, key: 'k2', itemId: '111111111111', date: '2026-10-05', price: 245, priceAt: '2026-10-06T09:10:00.000Z' }
    ],
    trafficRaw: [], itemHistory: {}, activeListings: null, sources: [],
    ads: { plpRows: [], keywordRows: [], searchRows: [] },
    products: api.PRODUCTS, productCounts: null
  });
  api.setUiProduct('all');
  api.ui.start = '';
  api.ui.end = '';
  api.applyProduct();
  const row = api.itemPerformance().find(entry => entry.itemId === '111111111111');
  assert.ok(row, '明细里找不到测试 Item');
  assert.equal(row.price, 229, `售价应按 priceAt 取最新（229），实际 ${row.price}`);
});

ok('手工核对剔除：820216825374/820216832219 快照按窗口扣减，本体出单保留', () => {
  const mk = over => ({ title: '🔥TOPDON AD600 Elite OBD2 Scanner Full System', product: 'AD600 Elite',
    campaign: 'C', campaignId: '1', totalImpressions: 0, totalPageViews: 0, quantitySold: 0,
    top20Promoted: 0, top20Organic: 0, restSearch: 0, totalSearch: 0, nonSearchPromoted: 0, nonSearchOrganic: 0,
    promotedEbayImpressions: 0, promotedOffsiteImpressions: 0, organicEbayImpressions: 0,
    promotedEbayViews: 0, promotedExternalViews: 0, organicEbayViews: 0, organicExternalViews: 0, ...over });
  api.setFullState({
    plgRaw: [
      { key: 'k1', itemId: '820216825374', date: '2026-10-10', title: 't', product: 'AD600 Elite', campaign: 'C', campaignId: '1',
        price: 0, priceAt: '2026-10-10T00:00:00.000Z', adImpressions: 0, adClicks: 0, adSold: 3, organicSold: 0, totalSold: 3, adSales: 0, adFees: 0 },
      { key: 'k2', itemId: '820216832219', date: '2026-10-09', title: 't', product: 'AD600 Elite', campaign: 'C', campaignId: '1',
        price: 0, priceAt: '2026-10-09T00:00:00.000Z', adImpressions: 0, adClicks: 0, adSold: 4, organicSold: 0, totalSold: 4, adSales: 0, adFees: 0 }
    ],
    trafficRaw: [
      // 07-29~10-27 快照：5374 出 7（前身 10-09×1、10-10×3、10-11×1；本体 10-20×1、10-26×1）
      mk({ itemId: '820216825374', start: '2026-07-29', end: '2026-10-27', totalImpressions: 60773, totalPageViews: 185, quantitySold: 7 }),
      // 219 本体未出单：快照 5 全部为前身出单
      mk({ itemId: '820216832219', start: '2026-07-29', end: '2026-10-27', totalImpressions: 71286, totalPageViews: 176, quantitySold: 5 }),
      // 本体出单窗口 11-01~11-08（11-06 出 1 台）不在剔除日期内，必须保留
      mk({ itemId: '820216825374', start: '2026-11-01', end: '2026-11-08', totalImpressions: 24804, totalPageViews: 90, quantitySold: 1 }),
      // 日度行：载入时应按日期扣减（10-10×3、10-09×4）
      mk({ itemId: '820216825374', start: '2026-10-10', end: '2026-10-10', totalImpressions: 100, totalPageViews: 8, quantitySold: 3 }),
      mk({ itemId: '820216832219', start: '2026-10-09', end: '2026-10-09', totalImpressions: 110, totalPageViews: 9, quantitySold: 4 })
    ],
    itemHistory: {}, activeListings: null, sources: [],
    ads: { plpRows: [], keywordRows: [], searchRows: [] },
    products: api.PRODUCTS, productCounts: null
  });
  api.setUiProduct('AD600 Elite');
  api.ui.start = '2026-07-29';
  api.ui.end = '2026-10-27';
  api.ui.trafficSource = 'snapshot';
  api.applyProduct();
  const selection = api.trafficSelection();
  const row = selection.rows.find(entry => entry.itemId === '820216825374');
  assert.equal(row.quantitySold, 2, `5374 快照销量应为 7-5=2（本体 10-20/10-26），实际 ${row.quantitySold}`);
  assert.equal(row.soldExcluded, 5, '5374 剔除量应为 5');
  assert.equal(row.soldRaw, 7, '5374 快照原值应留痕');
  assert.equal(row.soldManual, true, '5374 应标注 soldManual');
  const row219 = selection.rows.find(entry => entry.itemId === '820216832219');
  assert.equal(row219.quantitySold, 0, `219 快照销量应剔为 0，实际 ${row219.quantitySold}`);
  assert.equal(row219.soldExcluded, 5, '219 剔除量应为 5');
  assert.ok((selection.note || '').includes('人工订单核对剔除'), '对账文案缺人工核对说明');
  assert.ok((selection.swaps || []).some(swap => swap.itemId === '820216825374' && swap.manual), '换品明细缺手工剔除链接');
  // 本体出单窗口：11-06 的 1 台不在剔除日期内，必须原样保留
  api.ui.start = '2026-11-01';
  api.ui.end = '2026-11-08';
  const row2 = api.trafficSelection().rows.find(entry => entry.itemId === '820216825374');
  assert.equal(row2.quantitySold, 1, `本体 11-06 出单不应被剔除，实际 ${row2.quantitySold}`);
  assert.ok(row2.soldExcluded == null, '本体出单窗口不应产生剔除量');
  // 日度行载入时已按日期扣减
  const daily5374 = api.dataState.trafficRaw.find(r => r.itemId === '820216825374' && r.start === '2026-10-10' && r.end === '2026-10-10');
  assert.equal(daily5374.quantitySold, 0, '5374 的 10-10 日度销量应扣减为 0');
  assert.equal(daily5374.soldManualCut.quantitySold, 3, '日度扣减应留痕 3 台');
  const plg219 = api.dataState.plgRaw.find(r => r.itemId === '820216832219' && r.date === '2026-10-09');
  assert.equal(plg219.totalSold, 0, '219 的 10-09 PLG 总销量应扣减为 0');
  assert.equal(plg219.adSold, 0, '219 的 10-09 PLG 广告销量应扣减为 0');
  api.ui.start = '';
  api.ui.end = '';
  api.setUiProduct('all');
  api.applyProduct();
});

ok('手工核对剔除配置：与 shop 模板逐字一致', () => {
  const extract = text => {
    const match = text.match(/\/\/ === MANUAL-SOLD-EXCLUSIONS-START ===([\s\S]*?)\/\/ === MANUAL-SOLD-EXCLUSIONS-END ===/);
    assert.ok(match, '缺 MANUAL-SOLD-EXCLUSIONS 配置块');
    return match[1];
  };
  const online = extract(html);
  assert.ok(online.includes("'820216825374'") && online.includes("'820216832219'"), '手工剔除配置缺指定 Item');
  const shopPath = join(repoDir, '..', 'ebay-shop-dashboard', 'ebay-shop-dashboard.html');
  if (existsSync(shopPath)) assert.equal(extract(readFileSync(shopPath, 'utf8')), online, 'shop 模板的手工剔除配置与在线模板不一致');
});

ok('换品历史自愈：旧状态缺 itemHistory 时自动从报表行重建', () => {
  // 模拟旧版页面存进 IndexedDB 的状态：有报表行但没有 itemHistory。
  // 注意：预置行的前身标题行已被构建端过滤，前端重建只能恢复行内可见的多标题 item
  //（如 820216825374 的两个 AD600 Elite 标题）；完整历史由 start() 用预置 bundle 补全。
  api.setFullState({
    plgRaw: bundle.plgRaw,
    trafficRaw: bundle.trafficRaw,
    itemHistory: undefined,
    activeListings: bundle.activeListings,
    sources: bundle.sources,
    ads: bundle.ads,
    products: bundle.products,
    productCounts: bundle.productCounts
  });
  api.setUiProduct('all');
  api.applyProduct();
  assert.ok(api.dataState.itemHistory && Object.keys(api.dataState.itemHistory).length > 0, 'itemHistory 未从报表行重建');
  assert.ok(api.dataState.itemHistory['820216825374'], '重建结果缺 820216825374 的标题历史');
  // 空对象 itemHistory 也必须触发重建
  api.setFullState({
    plgRaw: bundle.plgRaw,
    trafficRaw: bundle.trafficRaw,
    itemHistory: {},
    activeListings: bundle.activeListings,
    sources: bundle.sources,
    ads: bundle.ads,
    products: bundle.products,
    productCounts: bundle.productCounts
  });
  api.setUiProduct('all');
  api.applyProduct();
  assert.ok(Object.keys(api.dataState.itemHistory || {}).length > 0, '空 itemHistory 未触发重建');
});

ok('换品剔除宁剔勿留：本体时期日报零覆盖时快照销量剔为 0', () => {
  // 模拟旧状态/缺日报场景：去掉 900E 两条链接 11-05~11-08 的日报行，
  // 窗口 11-01~11-08 内本体时期（11-05 起）零日报覆盖 → 快照销量应剔为 0 而不是保留原值。
  const strippedDaily = bundle.trafficRaw.filter(row =>
    !(['820289759002', '820289778048'].includes(row.itemId) && row.start === row.end && row.start >= '2026-11-05' && row.start <= '2026-11-08'));
  api.setFullState({
    plgRaw: bundle.plgRaw,
    trafficRaw: strippedDaily,
    itemHistory: bundle.itemHistory,
    activeListings: bundle.activeListings,
    sources: bundle.sources,
    ads: bundle.ads,
    products: bundle.products,
    productCounts: bundle.productCounts
  });
  api.setUiProduct('UltraDiag900 E');
  api.ui.start = '2026-11-01';
  api.ui.end = '2026-11-08';
  api.ui.trafficSource = 'snapshot';
  api.applyProduct();
  const selection = api.trafficSelection();
  for (const [itemId, rawSold] of [['820289759002', 2], ['820289778048', 1]]) {
    const row = selection.rows.find(r => r.itemId === itemId);
    assert.ok(row, `缺 ${itemId} 快照行`);
    assert.equal(row.quantitySold, 0, `${itemId} 零覆盖时应剔为 0`);
    assert.equal(row.soldExcluded, rawSold, `${itemId} 应剔除 ${rawSold} 台`);
    assert.equal(row.soldUncertain, true, `${itemId} 应标注不确定`);
  }
  // 恢复标准状态
  api.setFullState({
    plgRaw: bundle.plgRaw,
    trafficRaw: bundle.trafficRaw,
    itemHistory: bundle.itemHistory,
    activeListings: bundle.activeListings,
    sources: bundle.sources,
    ads: bundle.ads,
    products: bundle.products,
    productCounts: bundle.productCounts
  });
  api.ui.start = '';
  api.ui.end = '';
  api.setUiProduct('all');
  api.applyProduct();
});

console.log(`\n全部通过：${passed} 项`);
