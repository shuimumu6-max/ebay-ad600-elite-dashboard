# 任务：帮我在这台 Windows 电脑上装好「eBay 报表工具包」

> 用法：把下面「分隔线以下」的整段内容复制给你的 AI 助手。
> 能操作电脑的 AI（WorkBuddy、Cursor、Claude Code 等）会自己下载安装；
> 只能聊天的 AI 会给你一条条命令，你复制到 PowerShell 里执行即可。

---

你是我的 Windows 操作助手。请在我这台电脑上完成下面的安装与配置，最后给我一份结果报告。过程中遇到需要我决定或手动操作的地方，先停下来告诉我。

## 背景

- 工具用途：在**已登录 eBay 卖家后台的 Chrome/Edge** 上，批量自动下载各类报表（CSV）；再用本机离线看板看数据。数据只留在本机。
- 下载页（唯一官方来源）：https://shuimumu6-max.github.io/ebay-ad600-elite-dashboard/dist/
- 安装目录：桌面下的 `eBay报表工具包` 文件夹（安装脚本自动定位桌面，OneDrive 重定向也能找到；不要自己换路径）
- 环境要求：Windows 10 1809+ 或 Windows 11；自带 PowerShell 5.1 和 curl.exe；Chrome 或 Edge 且**已登录 eBay 卖家后台**。

## 第 0 步：先问我要这几项，缺了就问，禁止编造

1. `shopName`：店铺名，随便一个能认出来的名字（例：`AD600 Elite`）
2. `plpCampaigns`：优先促销刊登的活动 ID 列表（通常 3 个）
3. `plgCampaigns`：PLG 的活动 ID + 显示名列表

其余（报表目录、下载目录、端口）安装程序已经按默认值生成好，不用问我。
活动 ID 在哪找：eBay 卖家后台 → 广告 → Campaigns，列表里每个活动对应的数字 ID（也可以让我把旧店铺的配置 JSON 发你，照结构抄）。

## 第 1 步：下载并安装（⚠️ 不要双击 installer.cmd）

`installer.cmd` 末尾有等待按键，在自动化里会卡住。请带 `/quiet` 参数或直接跑这两条：

```powershell
$base = 'https://shuimumu6-max.github.io/ebay-ad600-elite-dashboard/dist/'
$s = Join-Path $env:TEMP 'ebay-setup.ps1'
Invoke-WebRequest "$base/setup.ps1" -OutFile $s -UseBasicParsing
powershell -NoProfile -ExecutionPolicy Bypass -File $s -Quiet
```

（等价写法：`curl.exe -L -o "$env:TEMP\installer.cmd" "https://shuimumu6-max.github.io/ebay-ad600-elite-dashboard/dist/installer.cmd"` 然后 `cmd /c "$env:TEMP\installer.cmd" /quiet`。）

预期结果：退出码 0，日志出现「安装完成！」，桌面的 `eBay报表工具包` 里有 `app\`、`ui\`、`看板\`、`bin\node.exe`、`报表控制台.cmd`、`my-shop.json`。
首次安装要下载约 83 MB 运行时（node.exe），慢是正常的；失败会自动重试 3 次，仍失败请看 `%TEMP%\ebay-install-log.txt`。

## 第 2 步：填店铺配置

安装程序已经生成 `my-shop.json`（在安装目录里），你只需把第 0 步问到的值填进去，**不需要设任何环境变量**：

```powershell
$cfg = "$env:USERPROFILE\Desktop\eBay报表工具包\my-shop.json"
```

用这个 JSON 结构覆盖 `shopName` / `plpCampaigns` / `plgCampaigns` 三项，其他键原样保留：

```json
{
  "shopName": "<店铺名>",
  "plpCampaigns": ["<PLP活动ID1>", "<PLP活动ID2>", "<PLP活动ID3>"],
  "plgCampaigns": [
    { "id": "<PLG活动ID>", "name": "<活动显示名>" }
  ]
}
```

改完用 `Get-Content $cfg -Raw | ConvertFrom-Json` 验证一次 JSON 没写坏（报错就是引号或逗号问题）。
（进阶：也可以把配置放别处，用环境变量 `EBAY_SHOP_CONFIG` 指过去，优先级更高；日常不需要。）

## 第 3 步：跑自检，把输出贴给我

```powershell
Set-Location "$env:USERPROFILE\Desktop\eBay报表工具包"
.\bin\node.exe app\check-options.mjs
.\bin\node.exe app\check-fields.mjs
```

- 第一条应能看到 `[店铺配置] 已读取：...my-shop.json`，并输出后台参数与界面控件一一对应、全部通过。
- `check-fields`：如果只报「08 非在售名单」「09 预定名单」缺 CSV，属于正常（这两类还没下载过）；出现其他不一致才算失败。
- 失败时把原始报错贴给我，不要自己猜着改。

## 第 4 步：浏览器调试开关（这一步只能我来点，你负责提示我）

请提示我完成下面三件事，然后等我回复「已开」：
1. 用 Chrome 或 Edge 打开 `chrome://inspect/#remote-debugging`；
2. 把 **Allow remote debugging** 开关打开（只需一次）；
3. 保留至少一个**已登录 eBay 卖家后台**的标签页，不要把所有标签页都关掉（全关会收回授权）。

## 第 5 步：启动确认

双击 `报表控制台.cmd`，或执行：

```powershell
& "$env:USERPROFILE\Desktop\eBay报表工具包\报表控制台.cmd"
```

预期：浏览器自动打开 `http://127.0.0.1:7788`，页面顶部的环境体检显示 Chrome 调试端口正常。
（控制台是常驻窗口，验证完可以让用户自己留着用；你不需要等它退出。端口被占用时安装程序已自动换过，以 `my-shop.json` 里的 `consolePort` 为准。）

## 第 6 步：给我结果报告（按这个格式）

- 安装路径、版本号（看 `app\` 文件是否齐全）
- 配置文件的完整路径，以及 `EBAY_SHOP_CONFIG` 是否已写入
- `check-options` 与 `check-fields` 的关键结论（原文一两行）
- 第 4 步我是否已完成
- 遗留问题 / 还需要我做什么（没有就写「无」）

## 禁止事项

- 不要删除或移动我电脑上除临时文件外的任何文件；不要改动 `看板\` 以外的既有资料。
- 不要 `git init`、不要推送到任何 Git 仓库（本包内没有 `.git`，也不需要）。
- 不要把我下载的报表、配置或店铺信息上传到任何外部服务。
- 活动 ID、店铺名这类信息不确定时必须问我，不要猜。

## 如果你不能直接操作我的电脑

那就按上面 6 步，一条一条给我**可直接复制**的命令或操作，并明确告诉我「每一步应该看到什么」。我贴结果给你，你再判断下一步，不要一次性丢一堆命令给我。
