# Reference notes

The tuner's open-string recordings, from
[tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments)
(samples CC BY 3.0; sources in `NOTICE.md` at the repository root).

Only the notes the tuner plays are here: E2 A2 D3 G3 B3 E4 for each set,
except `electric/`, which has no D3, G3, B3 or E4 and so carries C3, Fs3,
C4 and Ds4, played faster or slower (`src/features/practice/mic/sounds.ts`).

Each file was made from the original with:

```bash
ffmpeg -i <original>.mp3 -t 3 -af "afade=t=out:st=2.4:d=0.6" \
  -ac 1 -ar 44100 -c:a libmp3lame -b:a 96k <note>.mp3
```

`sounds.ts` lists each recording's own tuning, measured with the app's
pitch detector (the median over 0.3–2.5 s); playback corrects it, so
every reference note is in tune. Re-measure after replacing a file.
