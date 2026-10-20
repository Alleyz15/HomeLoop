# Local EffectCraft tools (macOS)

EffectCraft is used to author and render HomeLoop's decorative motion assets.
The frontend pages and interactive controls remain in `apps/web`.

The local macOS app installer and CLI are downloaded from the official
[EffectCraft v0.11.1 release](https://github.com/storytold/effectcraft/releases/tag/v0.11.1).
Downloads and extracted tools live in `.tools/effectcraft/0.11.1/` at the
repository root and are ignored by Git. These files are local to this checkout;
other contributors need their own downloads.

The app installer is `effectcraft-0.11.1-macos-universal.dmg`.
The command-line tool is extracted into the `cli/` subdirectory.
Invoke it from the repository root with:

```sh
.tools/effectcraft/0.11.1/cli/effectcraft-cli --help
```

Use this path in place of `effectcraft-cli` in the existing animation recipes.
Keep editable `.ecproj` files and artwork scripts under `design/effectcraft/`;
export web assets into `apps/web/public/animations/`.

Existing HomeLoop projects were authored with EffectCraft 0.10.0. Before
replacing an existing asset using 0.11.1, render and visually inspect it for
compatibility. Preserve the original project until the replacement is verified.

The browser editor is also available at [effectcraft.run](https://effectcraft.run/).
