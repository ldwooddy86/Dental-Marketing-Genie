# Leviathan · the unified console

One frame, fourteen dashboards. OmegaWeapon and the Hit Board sit at the core; twelve industry atlases hang off it in three
wings (legal, home services, healthcare); the Convergence map and the Agency Field read all of them at once.

This build (October 6, 2026) unifies the two dashboards this repository already carried with the Leviathan console and
adds the attached atlas:

| Wing | Atlas | What changed in this build |
|---|---|---|
| Home services | **DFW Thermal Debt Atlas** (build 4, the browser app edition) | New: `dist/DFW_Thermal_Debt_Atlas_4_preview.html` wrapped and registered beside the Louisiana Thermal Debt Atlas. Its 263 scored ZIPs feed Convergence as the HVAC (DFW) vertical. |
| Legal | **The Termination Exposure Atlas** (v8.2) | New: the employment law atlas, eight modules, every buyable US ZIP scored. Its 1,625 Texas and Louisiana ZIPs feed Convergence as Employment law. |
| Healthcare | **The Dental Divide Atlas** | Already inside the console; byte for byte the same build as `dental-divide-atlas.html` at the repository root. |

The other eleven dashboards (OmegaWeapon, Hit Board, Probable Cause, Contraflow, Severance, Louisiana Thermal Debt, Uplift,
Water Hammer, Swarm Front, Oncogene, Ocular Health) carry over unchanged.

## Files

| File | Size | Holds |
|---|---|---|
| `Leviathan.html` | 24 MB | The console frame, fonts, registry, and the ten smaller atlases packed inline (gzip + base64). |
| `Leviathan-data.js` | 26 MB | Severance, Dental Divide and Ocular Health, loaded on demand. |
| `Leviathan-data-2.js` | 10 MB | The Termination Exposure Atlas, loaded on demand. |
| `tools/build.py` | | The build script (see below). |

Every file stays under GitHub's 50 MB line; the three together are 60 MB. Keep them in one folder and open
`Leviathan.html` in a current Chrome, Edge, Safari or Firefox. Nothing runs on a server: each atlas unpacks in the browser
when you open it, and the five most recently opened stay live.

## Rebuilding

The script carries every payload over from a previous console build, wraps the two new atlases with the console's host
link and bridge, extends the registry (modules, wings, verticals, Convergence columns, Spearman correlations) and patches
the frame. Each patch asserts its anchor occurs exactly once, so an upstream change fails loudly instead of silently.

```
python3 leviathan/tools/build.py \
  --prev-html  <previous Leviathan.html> \
  --prev-data  <previous Leviathan-data.js> \
  --dfw        dist/DFW_Thermal_Debt_Atlas_4_preview.html \
  --termination <termination-exposure-atlas-v8_2.html> \
  --out        leviathan \
  --online     <folder>      # optional hosted edition: a 2 MB index.html plus m/<id>.txt, fetched on demand
```

## Hosted edition

`--online` writes a page without inline payloads and one `m/<id>.txt` file per dashboard; the console fetches them when an
atlas is opened. That layout is what the online copy of this build is published from. It needs an HTTP server (file://
blocks fetch), which is why the offline files above inline their payloads and use companion scripts instead.
