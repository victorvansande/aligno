$port = 5200
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Serving $root on http://localhost:$port/"
$mimes = @{
  '.html'=  'text/html; charset=utf-8'
  '.css'=   'text/css'
  '.js'=    'application/javascript'
  '.json'=  'application/json'
  '.svg'=   'image/svg+xml'
  '.otf'=   'font/otf'
  '.ttf'=   'font/ttf'
  '.ico'=   'image/x-icon'
  '.png'=   'image/png'
  '.jpg'=   'image/jpeg'
  '.webp'=  'image/webp'
  '.gif'=   'image/gif'
  '.webmanifest'= 'application/manifest+json'
}
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request; $res = $ctx.Response; $res.Headers.Add("Cache-Control", "no-store")
  $path = $req.Url.LocalPath -replace '/', '\'
  if ($path -eq '\') { $path = '\index.html' }
  $file = Join-Path $root $path.TrimStart('\')
  if (Test-Path $file -PathType Leaf) {
    $ext = [System.IO.Path]::GetExtension($file).ToLower()
    $res.ContentType = if ($mimes[$ext]) { $mimes[$ext] } else { 'application/octet-stream' }
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $res.StatusCode = 404
  }
  $res.OutputStream.Close()
}
