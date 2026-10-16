# HomeLoop Home — architectural gallery

Decorative original artwork authored with EffectCraft 0.10.0. It is not a
photograph of an advertised development, a live property list or a listing claim.
The three layered facade panels float, shift in perspective and catch a moving
highlight. The loop is independent of the Welcome houses, Sign-in doorway and
travelling-path film. No AI service or stock assets are required at runtime.

Source: `home-gallery.jsx`; generated editable project: `home-gallery.ecproj`.
Output: `../../apps/web/public/animations/homeloop-gallery.mp4` (720 × 280,
24 fps, twelve-second silent loop) and `homeloop-gallery-poster.png` (3s frame).

From the repository root, with the downloaded CLI on PATH:

```powershell
effectcraft-cli script design/effectcraft/home-gallery.jsx --empty --save-as design/effectcraft/home-gallery.ecproj
effectcraft-cli render-frame --project design/effectcraft/home-gallery.ecproj --comp "HomeLoop Gallery" --time 3 --out apps/web/public/animations/homeloop-gallery-poster.png
effectcraft-cli render --project design/effectcraft/home-gallery.ecproj --comp "HomeLoop Gallery" --out apps/web/public/animations/homeloop-gallery.mp4 --format h264 --fps 24 --start 0 --end 12 --audio off
```

The shared `DecorativeFilm` client component mounts muted automatic playback
only when reduced motion is not requested. Errors/autoplay rejection retain
the poster; runtime preference changes stop/remove both Home-page videos.
No pause/replay controls. Financial figures are not part of the artwork.
