# Mini-Titan - fabrique les icones PNG de l'appli (PowerShell 5.1 + System.Drawing / GDI+).
# Dessine la meme tete que icons/icon.svg (memes coordonnees, repere 512 x 512), en 4x puis reduit
# en bicubique haute qualite pour des bords bien lisses.
#   icons/icon-192.png, icons/icon-512.png   coins arrondis, transparents
#   icons/icon-maskable-512.png              fond plein bord a bord, sujet reduit (~62 %) dans la zone sure
#   icons/apple-touch-icon.png               180 x 180, fond opaque
# Lancer :  powershell -ExecutionPolicy Bypass -File icons\make-icons.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$here = Split-Path -Parent $MyInvocation.MyCommand.Definition
$inv  = [Globalization.CultureInfo]::InvariantCulture

function Col([string]$hex, [int]$alpha = 255) {
    $h = $hex.TrimStart('#')
    return [Drawing.Color]::FromArgb($alpha,
        [Convert]::ToInt32($h.Substring(0, 2), 16),
        [Convert]::ToInt32($h.Substring(2, 2), 16),
        [Convert]::ToInt32($h.Substring(4, 2), 16))
}

# Chemin facon SVG (commandes absolues M, L, C, Z) -> GraphicsPath
function PathOf([string]$d) {
    $p = New-Object Drawing.Drawing2D.GraphicsPath
    $tok = @([regex]::Matches($d, '[MLCZ]|-?\d+(?:\.\d+)?') | ForEach-Object { $_.Value })
    $i = 0
    [single]$cx = 0; [single]$cy = 0
    while ($i -lt $tok.Count) {
        $c = $tok[$i]; $i++
        if ($c -eq 'M') {
            $cx = [single]::Parse($tok[$i], $inv); $cy = [single]::Parse($tok[$i + 1], $inv); $i += 2
            $p.StartFigure()
        }
        elseif ($c -eq 'L') {
            [single]$x = [single]::Parse($tok[$i], $inv); [single]$y = [single]::Parse($tok[$i + 1], $inv); $i += 2
            $p.AddLine($cx, $cy, $x, $y)
            $cx = $x; $cy = $y
        }
        elseif ($c -eq 'C') {
            [single]$x1 = [single]::Parse($tok[$i], $inv);     [single]$y1 = [single]::Parse($tok[$i + 1], $inv)
            [single]$x2 = [single]::Parse($tok[$i + 2], $inv); [single]$y2 = [single]::Parse($tok[$i + 3], $inv)
            [single]$x  = [single]::Parse($tok[$i + 4], $inv); [single]$y  = [single]::Parse($tok[$i + 5], $inv)
            $i += 6
            $p.AddBezier($cx, $cy, $x1, $y1, $x2, $y2, $x, $y)
            $cx = $x; $cy = $y
        }
        elseif ($c -eq 'Z') { $p.CloseFigure() }
    }
    return , $p
}

function EllipseOf([single]$cx, [single]$cy, [single]$rx, [single]$ry, [single]$rot = 0) {
    $p = New-Object Drawing.Drawing2D.GraphicsPath
    $p.AddEllipse($cx - $rx, $cy - $ry, 2 * $rx, 2 * $ry)
    if ($rot -ne 0) {
        $m = New-Object Drawing.Drawing2D.Matrix
        $m.RotateAt($rot, (New-Object Drawing.PointF($cx, $cy)))
        $p.Transform($m)
        $m.Dispose()
    }
    return , $p
}

function RoundRectOf([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
    $p = New-Object Drawing.Drawing2D.GraphicsPath
    $d = 2 * $r
    $p.AddArc($x, $y, $d, $d, 180, 90)
    $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    return , $p
}

function Fill($g, $path, [Drawing.Color]$color) {
    $b = New-Object Drawing.SolidBrush($color)
    $g.FillPath($b, $path)
    $b.Dispose()
}

function Stroke($g, $path, [Drawing.Color]$color, [single]$width) {
    $pen = New-Object Drawing.Pen($color, $width)
    $pen.LineJoin = [Drawing.Drawing2D.LineJoin]::Round
    $pen.StartCap = [Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap   = [Drawing.Drawing2D.LineCap]::Round
    $g.DrawPath($pen, $path)
    $pen.Dispose()
}

# Halo : degrade radial d'une couleur vers transparent
function Glow($g, [single]$cx, [single]$cy, [single]$rx, [single]$ry, [string]$hex, [int]$alpha) {
    $p = EllipseOf $cx $cy $rx $ry
    $b = New-Object Drawing.Drawing2D.PathGradientBrush -ArgumentList (, $p)
    $b.CenterPoint = New-Object Drawing.PointF($cx, $cy)
    $b.CenterColor = Col $hex $alpha
    $b.SurroundColors = [Drawing.Color[]]@((Col $hex 0))
    # fondu en cloche (0 = bord, 1 = centre) : pas de bord de disque visible
    $bl = New-Object Drawing.Drawing2D.Blend(5)
    $bl.Positions = [single[]](0, 0.25, 0.5, 0.75, 1)
    $bl.Factors   = [single[]](0, 0.06, 0.25, 0.6, 1)
    $b.Blend = $bl
    $g.FillPath($b, $p)
    $b.Dispose(); $p.Dispose()
}

# ---- le dessin (repere 512, identique a icon.svg) ----

$OUT   = Col '#0c2b17'
$HEAD  = 'M 256 132 C 340 132 408 180 414 262 C 420 340 372 404 256 404 C 140 404 92 340 98 262 C 104 180 172 132 256 132 Z'
$PLATES = @(
    'M 186 84 C 202 100 222 124 236 150 L 152 186 C 152 150 166 110 186 84 Z',
    'M 326 84 C 310 100 290 124 276 150 L 360 186 C 360 150 346 110 326 84 Z',
    'M 256 44 C 268 74 296 118 306 160 L 206 160 C 216 118 244 74 256 44 Z'
)
$SHINES = @(
    'M 190 122 C 198 131 209 144 217 158 L 171 178 C 171 158 179 136 190 122 Z',
    'M 322 122 C 314 131 303 144 295 158 L 341 178 C 341 158 333 136 322 122 Z',
    'M 256 90 C 263 108 280 135 286 160 L 226 160 C 232 135 249 108 256 90 Z'
)

function Draw-Subject($g) {
    Glow $g 256 120 128 128 '#38e8ff' 166      # lueur turquoise des plaques
    Glow $g 256 400 180 42 '#04180c' 166       # ombre douce sous la tete

    # plaques dorsales
    foreach ($d in $PLATES) {
        $p = PathOf $d
        Fill $g $p (Col '#38e8ff')
        Stroke $g $p $OUT 10
        $p.Dispose()
    }
    foreach ($d in $SHINES) {
        $p = PathOf $d
        Fill $g $p (Col '#b6fbff' 204)
        $p.Dispose()
    }

    # tete
    $head = PathOf $HEAD
    $skin = New-Object Drawing.Drawing2D.LinearGradientBrush(
        (New-Object Drawing.PointF(0, 126)), (New-Object Drawing.PointF(0, 410)), (Col '#4cbd5f'), (Col '#35a149'))
    $g.FillPath($skin, $head)
    $skin.Dispose()

    $p = EllipseOf 190 190 56 22 -26;  Fill $g $p (Col '#7fe08a' 115); $p.Dispose()   # reflet
    $p = EllipseOf 256 340 104 56;     Fill $g $p (Col '#f6eea6');     $p.Dispose()   # museau
    $p = EllipseOf 132 318 20 13;      Fill $g $p (Col '#ff9db0' 217); $p.Dispose()   # joues
    $p = EllipseOf 380 318 20 13;      Fill $g $p (Col '#ff9db0' 217); $p.Dispose()
    Stroke $g $head $OUT 10
    $head.Dispose()

    # yeux
    foreach ($x in 186, 326) {
        $p = EllipseOf $x 256 26 30;            Fill $g $p $OUT;                $p.Dispose()
        $p = EllipseOf ($x - 9) 245 10 10;      Fill $g $p (Col '#ffffff');     $p.Dispose()
        $p = EllipseOf ($x + 9) 269 4.5 4.5;    Fill $g $p (Col '#ffffff' 230); $p.Dispose()
    }

    # museau : narines, sourire, petit croc
    foreach ($x in 239, 273) {
        $p = EllipseOf $x 316 4.5 6.5; Fill $g $p (Col '#0c2b17' 235); $p.Dispose()
    }
    $p = PathOf 'M 214 346 C 232 368 280 368 298 346'
    Stroke $g $p $OUT 8
    $p.Dispose()
    $p = PathOf 'M 272 359 L 281 376 L 290 353 Z'
    Fill $g $p (Col '#ffffff')
    Stroke $g $p $OUT 4
    $p.Dispose()
}

# $subject : echelle du sujet (1.1 = icone normale).  $rounded : coins arrondis transparents.
function Render([int]$size, [single]$subject, [bool]$rounded, [bool]$opaque, [string]$name) {
    $ss  = 4
    $big = $size * $ss
    $bmp = New-Object Drawing.Bitmap($big, $big, [Drawing.Imaging.PixelFormat]::Format32bppPArgb)
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode      = [Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode    = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([Drawing.Color]::Transparent)
    $k = $big / 512.0
    $g.ScaleTransform($k, $k)

    # fond : degrade #12432f -> #1f9d4d (diagonale)
    $bg = New-Object Drawing.Drawing2D.LinearGradientBrush(
        (New-Object Drawing.PointF(-6, -6)), (New-Object Drawing.PointF(518, 518)), (Col '#12432f'), (Col '#1f9d4d'))
    if ($rounded) { $shape = RoundRectOf 0 0 512 512 112 }
    else { $shape = New-Object Drawing.Drawing2D.GraphicsPath; $shape.AddRectangle((New-Object Drawing.RectangleF(-2, -2, 516, 516))) }
    $g.FillPath($bg, $shape)
    $bg.Dispose(); $shape.Dispose()

    # le sujet, centre (son centre visuel est en 256,224 dans le repere du dessin)
    $g.TranslateTransform(256, 256)
    $g.ScaleTransform($subject, $subject)
    $g.TranslateTransform(-256, -224)
    Draw-Subject $g
    $g.Dispose()

    # reduction 4x -> taille finale
    if ($opaque) { $fmt = [Drawing.Imaging.PixelFormat]::Format24bppRgb } else { $fmt = [Drawing.Imaging.PixelFormat]::Format32bppArgb }
    $out = New-Object Drawing.Bitmap($size, $size, $fmt)
    $g2 = [Drawing.Graphics]::FromImage($out)
    $g2.InterpolationMode  = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.PixelOffsetMode    = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g2.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
    if ($opaque) { $g2.Clear((Col '#12432f')) } else { $g2.Clear([Drawing.Color]::Transparent) }
    $ia = New-Object Drawing.Imaging.ImageAttributes
    $ia.SetWrapMode([Drawing.Drawing2D.WrapMode]::TileFlipXY)
    $g2.DrawImage($bmp, (New-Object Drawing.Rectangle(0, 0, $size, $size)), 0, 0, $big, $big, [Drawing.GraphicsUnit]::Pixel, $ia)
    $ia.Dispose(); $g2.Dispose(); $bmp.Dispose()

    $file = Join-Path $here $name
    $out.Save($file, [Drawing.Imaging.ImageFormat]::Png)
    $out.Dispose()
    Write-Output ("{0}  {1}x{1}  {2} octets" -f $name, $size, (Get-Item $file).Length)
}

Render 192 1.1  $true  $false 'icon-192.png'
Render 512 1.1  $true  $false 'icon-512.png'
Render 512 0.68 $false $true  'icon-maskable-512.png'     # 1.1 x 0.62 : tout tient dans le cercle de securite (80 %)
Render 180 1.02 $false $true  'apple-touch-icon.png'
