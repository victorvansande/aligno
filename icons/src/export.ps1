# Exports every app icon from the SVG sources in this folder (Windows).
#   powershell -ExecutionPolicy Bypass -File icons/src/export.ps1
# Each SVG is rendered at 1024 px by Edge (headless), then scaled down with
# high-quality resampling. Sizes and purposes are listed in DESIGN.md §17.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$src = $PSScriptRoot
$out = Split-Path $src -Parent
$tmp = Join-Path $env:TEMP 'aligno-icons'
New-Item -ItemType Directory -Force $tmp | Out-Null
$edge = @("$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe", "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge not found' }

function Render([string]$svg, [string]$png) {
  $html = Join-Path $tmp ([IO.Path]::GetFileNameWithoutExtension($svg) + '.html')
  $svgText = [IO.File]::ReadAllText((Join-Path $src $svg))
  $page = '<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block;width:1024px;height:1024px}</style></head><body>' + $svgText + '</body></html>'
  [IO.File]::WriteAllText($html, $page, (New-Object System.Text.UTF8Encoding($false)))
  # Edge logs harmless warnings to stderr; don't let them stop the script.
  $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  # Own throwaway profile: an Edge that is already open cannot keep the render waiting.
  & $edge --headless=new "--user-data-dir=$(Join-Path $tmp 'profile')" --no-first-run --disable-gpu --hide-scrollbars --default-background-color=00000000 --force-device-scale-factor=1 "--window-size=1024,1024" "--screenshot=$png" "file:///$($html -replace '\\','/')" 2>&1 | Out-Null
  $ErrorActionPreference = $prev
  if (-not (Test-Path $png)) { throw "Render failed for $svg" }
}

function Resize([string]$from, [string]$to, [int]$size, [bool]$opaque) {
  $img = [System.Drawing.Image]::FromFile($from)
  $fmt = if ($opaque) { [System.Drawing.Imaging.PixelFormat]::Format24bppRgb } else { [System.Drawing.Imaging.PixelFormat]::Format32bppArgb }
  $bmp = New-Object System.Drawing.Bitmap($size, $size, $fmt)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $attr = New-Object System.Drawing.Imaging.ImageAttributes
  $attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $size, $size)), 0, 0, $img.Width, $img.Height, [System.Drawing.GraphicsUnit]::Pixel, $attr)
  $g.Dispose(); $img.Dispose()
  $bmp.Save((Join-Path $out $to), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  "  $to ($size px)"
}

$full = Join-Path $tmp 'full.png'; $rounded = Join-Path $tmp 'rounded.png'; $mono = Join-Path $tmp 'mono.png'; $small = Join-Path $tmp 'small.png'; $ios = Join-Path $tmp 'ios.png'
Remove-Item $full, $rounded, $mono, $small, $ios -ErrorAction SilentlyContinue
Render 'icon-full.svg' $full
Render 'icon-rounded.svg' $rounded
Render 'icon-mono.svg' $mono
Render 'icon-small.svg' $small
Render 'icon-ios.svg' $ios

'Writing icons:'
Resize $ios 'apple-touch-icon.png' 180 $true       # iPhone / iPad home screen (iOS rounds the corners)
Resize $full 'icon-512-maskable.png' 512 $true     # Android adaptive icon (any mask shape)
Resize $full 'icon-192-maskable.png' 192 $true
Resize $rounded 'icon-512.png' 512 $false          # computers, splash screens, "any"
Resize $rounded 'icon-192.png' 192 $false
Resize $small 'favicon-32.png' 32 $false           # browser tab fallback (bolder small version)
Resize $small 'favicon-16.png' 16 $false
Resize $mono 'icon-monochrome.png' 512 $false      # Android themed icons
Copy-Item (Join-Path $src 'icon-small.svg') (Join-Path $out 'icon.svg') -Force
'  icon.svg (browser tab, scalable)'
