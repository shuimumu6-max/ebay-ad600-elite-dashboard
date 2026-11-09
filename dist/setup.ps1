$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = 'Tls12'
$base = 'https://shuimumu6-max.github.io/ebay-ad600-elite-dashboard/dist/'
$dest = Join-Path $env:USERPROFILE 'Desktop\eBay报表工具包'

Write-Host ''
Write-Host "安装目录：$dest"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$manifest = Invoke-RestMethod -Uri "$base/manifest.json"
Write-Host "最新版本：$($manifest.version)（$($manifest.createdAt)）"

# 1) 运行时：只在首次安装（或缺失）时下载 83 MB 的 node.exe
$nodeTarget = Join-Path $dest 'bin\node.exe'
if (-not (Test-Path $nodeTarget)) {
  Write-Host '首次安装：正在下载运行时（约 83 MB）...'
  $nodeTemp = Join-Path $env:TEMP 'ebay-node.exe'
  Invoke-WebRequest -Uri "$base/files/$($manifest.runtime.hash)" -OutFile $nodeTemp -UseBasicParsing
  New-Item -ItemType Directory -Force -Path (Join-Path $dest 'bin') | Out-Null
  Copy-Item $nodeTemp $nodeTarget -Force
  Remove-Item $nodeTemp -Force
  Write-Host '运行时就绪。'
} else {
  Write-Host '运行时已存在，跳过下载。'
}

# 2) 程序文件（约 1 MB）：只覆盖程序，不动店铺配置与报表数据
Write-Host '正在下载程序文件（约 1 MB）...'
$zip = Join-Path $env:TEMP 'ebay-toolkit.zip'
Invoke-WebRequest -Uri "$base/toolkit.zip" -OutFile $zip -UseBasicParsing
$expand = Join-Path $env:TEMP 'ebay-toolkit-expand'
if (Test-Path $expand) { Remove-Item $expand -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $expand -Force
Copy-Item (Join-Path $expand 'eBay报表工具包\*') $dest -Recurse -Force
Remove-Item $zip -Force
Remove-Item $expand -Recurse -Force

Write-Host ''
Write-Host '安装完成！接下来三步：' -ForegroundColor Green
Write-Host ' 1. 复制「新店铺配置示例.json」改成自己的店铺值，另存为 my-shop.json，并设环境变量 EBAY_SHOP_CONFIG 指向它'
Write-Host ' 2. 浏览器登录 eBay 后台，打开 chrome://inspect/#remote-debugging 把 Allow remote debugging 拨到开（只需一次）'
Write-Host ' 3. 双击「报表控制台.cmd」开始下载；看数据双击「打开看板.cmd」'
Write-Host ''
Write-Host '以后有新版本：双击「检查更新.cmd」即可，配置和数据不会被覆盖。'
Start-Process explorer.exe -ArgumentList $dest
