param(
  [switch]$Quiet,
  [string]$Dest = ''
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = 'Tls12'
$ProgressPreference = 'SilentlyContinue'
$base = 'https://shuimumu6-max.github.io/ebay-ad600-elite-dashboard/dist/'
if (-not $Dest -and $env:EBAY_INSTALL_DEST) { $Dest = $env:EBAY_INSTALL_DEST }
$logPath = Join-Path $env:TEMP 'ebay-install-log.txt'
$logLines = New-Object System.Collections.Generic.List[string]
$ok = $false

function Line($text, $color = 'Gray') {
  Write-Host $text -ForegroundColor $color
  $script:logLines.Add($text)
}

function Get-Remote($url, $out) {
  for ($i = 1; $i -le 3; $i++) {
    try {
      Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing -TimeoutSec 120
      return
    } catch {
      if ($i -eq 3) { throw }
      Line "    下载中断，2 秒后重试（第 $i/3 次）..." 'Yellow'
      Start-Sleep -Seconds 2
    }
  }
}

function Get-FreePort($start) {
  for ($p = $start; $p -lt ($start + 20); $p++) {
    try {
      $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
      $listener.Start()
      $listener.Stop()
      return $p
    } catch { }
  }
  return $start
}

try {
  Line ''
  Line '==================================================' 'Cyan'
  Line '        eBay 报表工具包 · 安装程序' 'Cyan'
  Line '==================================================' 'Cyan'
  Line ''

  if (-not $Dest) {
    $desktop = [Environment]::GetFolderPath('Desktop')
    if (-not $desktop) { throw '找不到桌面目录（Desktop 文件夹被重定向或不可写）。' }
    $Dest = Join-Path $desktop 'eBay报表工具包'
  }
  Line "安装目录：$Dest"
  Line ''

  $manifest = Invoke-RestMethod -Uri "$base/manifest.json" -UseBasicParsing -TimeoutSec 60
  Line "最新版本：$($manifest.version)（$($manifest.createdAt)）"
  Line ''

  New-Item -ItemType Directory -Force -Path $Dest | Out-Null

  # 1) 运行时（node.exe，约 83 MB，只在首次安装或缺失时下载）
  $nodeTarget = Join-Path $Dest 'bin\node.exe'
  if (-not (Test-Path $nodeTarget)) {
    Line '[1/3] 首次安装，正在下载运行时（约 83 MB，慢一点是正常的，别关窗口）...' 'White'
    $tmpNode = Join-Path $env:TEMP 'ebay-node.exe'
    Get-Remote "$base/files/$($manifest.runtime.hash)" $tmpNode
    New-Item -ItemType Directory -Force -Path (Join-Path $Dest 'bin') | Out-Null
    Copy-Item $tmpNode $nodeTarget -Force
    Remove-Item $tmpNode -Force -ErrorAction SilentlyContinue
    Line '      运行时就绪。' 'Green'
  } else {
    Line '[1/3] 运行时已存在，跳过下载。'
  }

  # 2) 程序文件（约 1 MB，只覆盖程序，不动配置和报表数据）
  Line '[2/3] 正在下载程序文件（约 1 MB）...' 'White'
  $zip = Join-Path $env:TEMP 'ebay-toolkit.zip'
  $expand = Join-Path $env:TEMP ('ebay-toolkit-' + [Guid]::NewGuid().ToString('N'))
  Get-Remote "$base/toolkit.zip" $zip
  Expand-Archive -Path $zip -DestinationPath $expand -Force
  Copy-Item (Join-Path $expand 'eBay报表工具包\*') $Dest -Recurse -Force
  Remove-Item $zip -Force -ErrorAction SilentlyContinue
  Remove-Item $expand -Recurse -Force -ErrorAction SilentlyContinue
  Line '      程序文件就绪。' 'Green'

  # 3) 配置文件：放安装目录就生效，不需要设环境变量
  Line '[3/3] 准备店铺配置...' 'White'
  $configPath = Join-Path $Dest 'my-shop.json'
  if (Test-Path $configPath) {
    Line '      my-shop.json 已存在，保留你原来的配置，不覆盖。' 'Green'
  } else {
    $port = Get-FreePort 7788
    $dataDir = (Join-Path $Dest '数据') -replace '\\', '/'
    $runsDir = (Join-Path $Dest '下载结果') -replace '\\', '/'
    $downloadsDir = ((Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Downloads')) -replace '\\', '/'
    # 手写 JSON 而不是 ConvertTo-Json：字段顺序固定、空数组写成 []、不带 BOM（BOM 会让 Node 解析失败）
    $json = @"
{
  "_说明": "填好下面几项保存即可；不用设环境变量，程序会自动读本文件夹的 my-shop.json。",
  "_活动ID在哪找": "eBay 卖家后台 → 广告 → Campaigns，活动名字后面那串数字 ID。",
  "shopName": "请改成你的店铺名",
  "dataDir": "$dataDir",
  "runsDir": "$runsDir",
  "downloadsDir": "$downloadsDir",
  "dashboardUrl": "",
  "plpCampaigns": [],
  "plgCampaigns": [],
  "consolePort": $port,
  "bridgePort": 9233
}
"@
    [IO.File]::WriteAllText($configPath, $json, (New-Object System.Text.UTF8Encoding($false)))
    Line '      my-shop.json 已生成（等下只需填店铺名和活动 ID）。' 'Green'
  }

  Line ''
  Line '==================================================' 'Green'
  Line '   安装完成！' 'Green'
  Line '==================================================' 'Green'
  Line ''
  Line '接下来只需两件事：' 'White'
  Line '  ① 在打开的文件夹里双击 my-shop.json，把「店铺名」和两个「活动 ID」填上，保存。'
  Line '     （活动 ID：eBay 后台 → 广告 → Campaigns，活动名后面那串数字）'
  Line '  ② 浏览器登录 eBay 后台 → 打开 chrome://inspect/#remote-debugging'
  Line '     → 把 Allow remote debugging 拨到开（只需一次）。'
  Line ''
  Line ' 然后双击「报表控制台.cmd」就能用了。看数据双击「打开看板.cmd」。' 'White'
  Line ''
  Line ' 以后有新版本：双击「检查更新.cmd」，配置和报表数据不会被覆盖。'
  $ok = $true
} catch {
  Line ''
  Line '[安装失败]' 'Red'
  Line ('  原因：' + $_.Exception.Message) 'Red'
  Line ''
  Line '  常见原因：网络或公司代理拦截 github.io / 下载被安全软件拦下 / 磁盘空间不足。' 'Yellow'
  Line '  可以再双击一次 installer.cmd 重试；也可以让管理员直接发离线的完整压缩包。' 'Yellow'
  Line ("  详细日志已保存：$logPath（把它发给管理员即可）") 'Yellow'
} finally {
  try { $logLines | Set-Content -Path $logPath -Encoding UTF8 } catch { }
  if (-not $Quiet) {
    if ($ok) { try { Start-Process explorer.exe -ArgumentList $Dest } catch { } }
    Line ''
    Read-Host '按回车键关闭窗口' | Out-Null
  }
}

if ($ok) { exit 0 }
exit 1
