# youtube-dl-url

URL endpoint for streaming video service URLs in custom video players. Especially useful on mobile. Also works with playlists (returns m3u). Based on [youtube-dl](https://yt-dl.org).

```
https://example.com/<VIDEO URL>

https://example.com/https://www.youtube.com/watch?v=g6-533Cw57U

https://example.com/https://www.youtube.com/playlist?list=PLMC9KNsInrKtANr2kFJuXBVmHev6cAJ5u

...
```

## Running

```
PORT=3000 yarn start
```

## TODO

Subtitles (possibly using HLS or DASH)

## Won't be added (probably)

Fragmented stream support (don't need it myself)

## License

This software is licensed under the GNU Affero General Public License v3.0. A copy can be found under [LICENSE](LICENSE).
