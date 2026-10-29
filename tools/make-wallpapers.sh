#!/usr/bin/env bash
# Genera gli sfondi (scuro e chiaro) con ImageMagick, dalla palette di Touch OS.
#
# Il disegno è un'aurora: tre luci morbide (iris, azzurro, un tocco di rosa) che si sovrappongono su un fondo
# inchiostro, o su una nuvola chiara. Niente linee né testo: uno sfondo per un'interfaccia che si tocca deve
# lasciare in pace le icone. Si disegna a un quarto di risoluzione, si sfoca forte e si ingrandisce; un velo di rumore
# fine impedisce le bande nei gradienti.
#
# Uso: tools/make-wallpapers.sh [cartella-uscita]     (predefinito: wallpapers/)   Richiede ImageMagick.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$ROOT/wallpapers}"
W=3840; H=2160
HW=$((W / 4)); HH=$((H / 4))

command -v magick >/dev/null || { echo "serve ImageMagick (comando 'magick')" >&2; exit 1; }
mkdir -p "$OUT"

# glow COLORE CX CY RX RY OPACITA  → aggiunge ad ARGS un'ellisse colorata, sfocata, sovrapposta (alla risoluzione di lavoro)
ARGS=()
glow() {
    local color=$1 cx=$2 cy=$3 rx=$4 ry=$5 op=$6
    ARGS+=( '(' -size "${HW}x${HH}" xc:none -fill "$color" -draw "ellipse $cx,$cy $rx,$ry 0,360"
            -blur "0x$((rx / 3))" -channel A -evaluate multiply "$op" +channel ')' -compose over -composite )
}

# nome  fondo  luce1(iris)  luce2(azzurro)  luce3(rosa)  luce4(profondità)  op1 op2 op3 op4
make() {
    local name=$1 base=$2 c1=$3 c2=$4 c3=$5 c4=$6 o1=$7 o2=$8 o3=$9 o4=${10}
    ARGS=( -size "${HW}x${HH}" "xc:$base" )
    glow "$c4" $((HW * 50 / 100)) $((HH * 120 / 100)) $((HW * 70 / 100)) $((HH * 45 / 100)) "$o4"
    glow "$c1" $((HW * 22 / 100)) $((HH * 24 / 100)) $((HW * 42 / 100)) $((HH * 50 / 100)) "$o1"
    glow "$c2" $((HW * 82 / 100)) $((HH * 78 / 100)) $((HW * 44 / 100)) $((HH * 46 / 100)) "$o2"
    glow "$c3" $((HW * 74 / 100)) $((HH * 16 / 100)) $((HW * 26 / 100)) $((HH * 34 / 100)) "$o3"
    magick "${ARGS[@]}" -filter Lanczos -resize 400% -attenuate 0.35 +noise Gaussian -depth 8 \
        -quality 92 "$OUT/$name.jpg"
    echo "  $name.jpg"
}

#     nome         fondo      iris       azzurro    rosa       profondità  o1   o2   o3   o4
make touch-dark  '#0c0d14' '#5446d8' '#2262cf' '#b94cc4' '#05060a'     0.60 0.46 0.22 0.70
make touch-light '#eef0f9' '#a9b2ff' '#9ed0ff' '#ffc4dd' '#ffffff'     0.85 0.70 0.55 0.80
