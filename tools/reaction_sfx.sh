#!/usr/bin/env bash
# Cuts and levels the reaction clips in public/sfx/ (src/audio/samples.ts) from Kenney's CC0
# packs: Impact Sounds and Sci-Fi Sounds (https://kenney.nl/assets), unzipped under $1.
# Each clip: mono, 44.1 kHz, peak at -3 dB, MP3 64 kbps. Needs ffmpeg and python.
#   bash tools/reaction_sfx.sh path/to/kenney
set -euo pipefail
K=${1:?folder with the unzipped Kenney packs}
O=$(cd "$(dirname "$0")/.." && pwd)/public/sfx
T=$(mktemp -d)
mkdir -p "$O"
f() { find "$K" -name "$1" | head -1; }
mk() { # name, filter graph, ffmpeg inputs
  name=$1; shift; filt=$1; shift
  ffmpeg -v error -y "$@" -filter_complex "$filt,aformat=channel_layouts=mono:sample_rates=44100[o]" -map "[o]" -f wav "$T/$name.wav"
  peak=$(ffmpeg -i "$T/$name.wav" -af volumedetect -f null - 2>&1 | grep max_volume | grep -oE '\-?[0-9.]+ dB' | cut -d' ' -f1)
  g=$(python -c "print(-3-($peak))")
  ffmpeg -v error -y -i "$T/$name.wav" -af "volume=${g}dB" -c:a libmp3lame -b:a 64k "$O/rx_$name.mp3"
  echo "rx_$name peak=$peak gain=$g $(wc -c < "$O/rx_$name.mp3")B"
}
mk steam "[0]atrim=0.5:1.0,asetpts=N/SR/TB,highpass=f=1800,afade=t=in:d=0.01,afade=t=out:st=0.2:d=0.3[o0];[1]volume=0.35[o1];[o0][o1]amix=inputs=2:duration=first:normalize=0" -i "$(f thrusterFire_000.ogg)" -i "$(f slime_000.ogg)"
mk superconduct "[0]atrim=0:0.43,asetpts=N/SR/TB,afade=t=out:st=0.3:d=0.13[o0];[1]atrim=0:0.25,volume=0.5[o1];[o0][o1]amix=inputs=2:duration=first:normalize=0" -i "$(f impactGlass_heavy_001.ogg)" -i "$(f laserRetro_002.ogg)"
mk overload "[0]atrim=0:0.75,asetpts=N/SR/TB,afade=t=out:st=0.45:d=0.3[o0];[1]volume=0.45[o1];[o0][o1]amix=inputs=2:duration=first:normalize=0" -i "$(f explosionCrunch_000.ogg)" -i "$(f laserRetro_000.ogg)"
mk electrolysis "[0]atrim=0:0.6,asetpts=N/SR/TB,afade=t=in:d=0.01,afade=t=out:st=0.35:d=0.25[o0];[1]volume=0.6[o1];[o0][o1]amix=inputs=2:duration=first:normalize=0" -i "$(f forceField_001.ogg)" -i "$(f slime_000.ogg)"
mk combustion "[0]atrim=0:0.85,asetpts=N/SR/TB,afade=t=out:st=0.5:d=0.35[o0];[1]atrim=0:0.6,volume=0.6[o1];[o0][o1]amix=inputs=2:duration=first:normalize=0" -i "$(f lowFrequency_explosion_001.ogg)" -i "$(f explosionCrunch_002.ogg)"
mk firestorm "[0]atrim=1.0:1.8,asetpts=N/SR/TB,lowpass=f=2600,afade=t=in:d=0.12,afade=t=out:st=0.45:d=0.35" -i "$(f thrusterFire_002.ogg)"
mk blizzard "[0]atrim=2.0:2.7,asetpts=N/SR/TB,highpass=f=2500,afade=t=in:d=0.15,afade=t=out:st=0.35:d=0.35[o0];[1]adelay=60,volume=0.55[o1];[o0][o1]amix=inputs=2:duration=first:normalize=0" -i "$(f thrusterFire_004.ogg)" -i "$(f impactGlass_light_002.ogg)"
mk resonance "[0]atrim=0:0.7,asetpts=N/SR/TB,afade=t=out:st=0.4:d=0.3" -i "$(f impactBell_heavy_002.ogg)"
rm -rf "$T"
