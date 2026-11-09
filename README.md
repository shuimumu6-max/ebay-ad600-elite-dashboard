# eBay 流量与广告看板

公开只读的 eBay 运营看板，同时覆盖两个产品：**AD600 Elite**（SKU `TD52110512`）与 **UltraDiag900 E**（SKU `TD52110602`）。顶部可切换「全部 / AD600 Elite / UltraDiag900 E」。

- 在线地址：<https://shuimumu6-max.github.io/ebay-ad600-elite-dashboard/>
- 数据维度：Traffic、PLG、PLP、Campaign、关键词、搜索词、竞价调整。
- 产品识别：按报表当时的标题 token 与 campaign 名判定；在售名单快照另用 `Custom label (SKU)` 兜底。SKU 不倒推历史流量行，避免 Item number 复用导致错算。
- UltraDiag900 E 目前只有 Traffic + PLG 数据；PLP / 关键词 / 搜索词来自单产品口径的外部广告快照，切到该产品时显示「暂无数据」提示。
- Traffic 和 PLG 由维护者在本地清洗，PLP 和词数据从指定广告看板快照同步后统一发布；每次发布都是全量重算，因此两个产品会自动一起更新。
- 仓库不包含原始 CSV、日志、登录信息或本地文件路径。

## 本地自检

在 `看板源码/ebay-online-dashboard/` 目录下用仓库内的 `bin\node.exe` 运行：

```
check-products.mjs            产品常量一致性、识别口径、历史数据不丢失
check-frontend.mjs            产品切换器切片 / 空态 / 数据恢复（无需浏览器）
node --test test-update.mjs   CSV 解析与 bundle 构建单测
```

HTML 源文件在 `看板源码/ebay-traffic-dashboard/ebay-traffic-dashboard.html`；本仓库的 `index.html` 是发布时由 `syncHtml()` 复制生成的产物，不要手改。
