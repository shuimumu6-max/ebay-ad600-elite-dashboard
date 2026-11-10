# 任务：帮我在这台 Windows 电脑上装好「eBay 报表工具包」

> 用法：把下面「分隔线以下」的整段内容复制给你的 AI 助手。
> 能操作电脑的 AI（WorkBuddy、Cursor、Claude Code 等）会自己下载安装；
> 只能聊天的 AI 会给你一条条命令，你复制到 PowerShell 里执行即可。

---

你是我的 Windows 操作助手。请在我这台电脑上完成下面的安装，最后给我一份结果报告。过程中需要我手动操作的地方（只有浏览器调试开关那一步），先停下来告诉我。

**重要：全程不需要问我要店铺名、活动 ID 或任何配置。** 这个工具会自动识别：店铺名在界面里能随时改；活动不填就是后台全部活动。

## 背景

- 工具用途：在**已登录 eBay 卖家后台的 Chrome/Edge** 上，批量自动下载各类报表（CSV）；再用本机离线看板看数据。数据只留在本机，不上传任何服务器。
- 下载页（唯一官方来源）：https://shuimumu6-max.github.io/ebay-ad600-elite-dashboard/dist/
- 安装目录：桌面下的 `eBay报表工具包` 文件夹（安装脚本自动定位桌面，OneDrive 重定向也能找到；不要自己换路径）。
- 环境要求：Windows 10 1809+ 或 Windows 11；自带 PowerShell 5.1 和 curl.exe；Chrome 或 Edge 且**已登录 eBay 卖家后台**。

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

不要修改 `my-shop.json`：安装程序已经生成好，里面不需要填任何东西（`shopName` 空着就是「我的店铺」，活动空数组就是「后台全部活动」）。

## 第 2 步：浏览器调试开关（这一步只能我来点，你负责提示我）

请提示我完成下面三件事，然后等我回复「已开」：
1. 用 Chrome 或 Edge 打开 `chrome://inspect/#remote-debugging`；
2. 把 **Allow remote debugging** 开关打开（只需一次）；
3. 保留至少一个**已登录 eBay 卖家后台**的标签页，不要把所有标签页都关掉（全关会收回授权）。

## 第 3 步：启动控制台

双击 `报表控制台.cmd`，或执行：

```powershell
& "$env:USERPROFILE\Desktop\eBay报表工具包\报表控制台.cmd"
```

预期：浏览器自动打开 `http://127.0.0.1:7788`，页面顶部显示 Chrome 连接正常，右上角显示店铺名（默认「我的店铺」）。
（控制台是常驻窗口，验证完保持打开；端口被占用时安装程序已自动换过，以 `my-shop.json` 里的 `consolePort` 为准。）

## 第 4 步：下载最近 2 周数据（看板一打开就有内容）

页面最上面有一个「**自动下载最近 2 周**」的按钮，请提示我点它（或你直接调接口触发）：

```powershell
$body = '{"days":14}'
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:7788/api/first-run' -ContentType 'application/json' -Body $body
```

**天数就填 14，不要填 30。** 原因有两个，都不是配置问题：eBay 的广告「按日」数据只回溯两周；流量报表还有账号级频率限制，一次性连下 30 份大概率在第 16 份左右被拦下来，要等一小时才能继续。14 天刚好够做「上周 vs 本周」对比。

它会串行下载：流量报表（逐日 14 份）、PLG 链接广告 + 优先促销刊登（物品刊登 / 关键词 / 活动 / 搜索词，各下本周和上周）、在售商品名单。**大约 8~15 分钟**，不要关控制台窗口。

万一中途提示「先歇一会儿」（被限速）：已经下好的不会重复，隔一小时点控制台右侧「补齐缺口 + 更新看板」接着补即可，不是装坏了。

你不需要一直等；告诉我去看日志就行。跑完后在控制台右上角点「打开本机看板」——看板会自动加载 `数据` 里的报表，**不需要手动选文件**。

## 第 5 步：跑自检，把输出贴给我

```powershell
Set-Location "$env:USERPROFILE\Desktop\eBay报表工具包"
.\bin\node.exe app\check-options.mjs
.\bin\node.exe app\check-fields.mjs
```

- 第一条应能看到 `[店铺配置] 已读取：...my-shop.json`，并输出后台参数与界面控件一一对应、全部通过。
- `check-fields`：如果只报「08 非在售名单」「09 预定名单」缺 CSV，属于正常（这两类还没下载过）；出现其他不一致才算失败。
- 失败时把原始报错贴给我，不要自己猜着改。

## 第 6 步：给我结果报告（按这个格式）

- 安装路径、版本号（看 `app\` 文件是否齐全）
- 配置文件路径（`my-shop.json`），确认没有手改过
- `check-options` 与 `check-fields` 的关键结论（原文一两行）
- 第 2 步调试开关是否已打开
- 首次 2 周（14 天）下载是否已启动 / 是否需要我自己点
- 遗留问题 / 还需要我做什么（没有就写「无」）

## 禁止事项

- 不要删除或移动我电脑上除临时文件外的任何文件；不要改动 `看板\` 以外的既有资料。
- 不要手改 `my-shop.json` 里的路径、端口、活动字段（除非我明确要求）。
- 不要 `git init`、不要推送到任何 Git 仓库（本包内没有 `.git`，也不需要）。
- 不要把我下载的报表、配置或店铺信息上传到任何外部服务。

## 如果你不能直接操作我的电脑

那就按上面 6 步，一条一条给我**可直接复制**的命令或操作，并明确告诉我「每一步应该看到什么」。我贴结果给你，你再判断下一步，不要一次性丢一堆命令给我。
