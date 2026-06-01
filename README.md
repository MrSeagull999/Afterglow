# AfterGlow

A local desktop application + CLI for bulk converting real estate photos into professional twilight/blue-hour versions using Google Gemini Image API.

## Features

- **Preview → Lock → Final workflow**: Generate quick previews, approve the ones you like, then generate final 4K images
- **Desktop UI**: Modern, minimal interface built with Electron + React + TailwindCSS
- **CLI**: Full command-line interface for power users
- **Batch Processing**: Cost-effective batch mode for final 4K generation
- **Multiple Presets**: Professional twilight presets for exteriors, interiors, and pools
- **EXIF Handling**: Strip metadata by default for privacy (configurable)
- **Resumable Runs**: Pick up where you left off with persistent run state

## Requirements

- Node.js 18+
- macOS (primary target)
- Google Gemini API key

## Setup

1. **Clone and install dependencies:**

```bash
cd afterglow
npm install
```

2. **Configure your API key:**

```bash
cp .env.example .env
```

Edit `.env` and add your Gemini API key:

```
GEMINI_API_KEY=your_actual_api_key_here
```

Get your API key from: https://makersuite.google.com/app/apikey

3. **Run in development mode:**

```bash
npm run dev
```

4. **Build for production:**

```bash
npm run electron:build
```

## Usage

### Desktop App

1. Launch the app
2. Click "Select Listing Folder" and choose a folder containing property photos
3. Select a preset (e.g., "Twilight Exterior - Classic")
4. Click "Run Preview" to generate preview images
5. Review previews and approve the ones you want to finalize
6. Click "Finalize 4K" to generate final high-resolution images

### CLI

```bash
# List available presets
npm run afterglow presets

# Generate previews
npm run afterglow preview --input ./photos/123-main-st --preset twilight_exterior_classic

# Check run status
npm run afterglow status --run 20240115-143022_123-main-st_preview

# Finalize approved images (batch mode)
npm run afterglow finalize --run 20240115-143022_123-main-st_preview --batch

# Fetch batch results
npm run afterglow fetch --run 20240115-143022_123-main-st_preview

# List all runs
npm run afterglow runs
```

## Project Structure

```
afterglow/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry point
│   │   ├── ipc.ts               # IPC handlers
│   │   └── core/
│   │       ├── fileScan.ts      # Directory scanning
│   │       ├── runStore.ts      # Run persistence
│   │       ├── promptBank.ts    # Preset management
│   │       ├── costEstimate.ts  # Cost calculations
│   │       ├── exif.ts          # EXIF handling
│   │       ├── settings.ts      # App settings
│   │       ├── gemini/          # Gemini API integration
│   │       │   ├── geminiClient.ts
│   │       │   ├── previewGenerate.ts
│   │       │   ├── batchSubmit.ts
│   │       │   ├── batchPoll.ts
│   │       │   ├── batchFetch.ts
│   │       │   └── jsonl.ts
│   │       └── image/           # Image processing
│   │           ├── thumb.ts
│   │           ├── imageIO.ts
│   │           └── formats.ts
│   ├── preload/                 # Electron preload script
│   ├── renderer/                # React UI
│   │   ├── App.tsx
│   │   ├── store/               # Zustand state
│   │   ├── components/          # UI components
│   │   └── pages/               # Page views
│   └── cli/                     # CLI implementation
├── prompt-bank/
│   └── presets.json             # Twilight presets
├── runs/                        # Generated run data
└── afterglow-output/            # Generated images
```

## Presets

| Preset ID | Description |
|-----------|-------------|
| `twilight_exterior_classic` | Classic blue-hour twilight for exteriors |
| `twilight_exterior_premium` | Premium twilight with enhanced drama |
| `twilight_exterior_soft` | Soft, gentle twilight effect |
| `twilight_interior_evening` | Interior with evening ambiance |
| `twilight_interior_night_subtle` | Subtle night interior |
| `twilight_pool_luxury` | Luxury twilight for pool areas |

## Output Structure

```
afterglow-output/
└── {listing-name}/
    ├── _previews/               # Preview images (~1536px)
    │   ├── photo1_preview.png
    │   └── photo2_preview.png
    ├── photo1_afterglow.png     # Final 4K images
    └── photo2_afterglow.png
```

## Run Data

Each run creates a folder in `runs/` with:

- `run.json` - Run configuration and image status
- `approved.json` - List of approved images
- `preview/` - Preview artifacts
- `batch/` - Batch job data (JSONL files, batch info)
- `summary.csv` - Status summary

## Cost Estimates

- **Preview**: ~$0.04 per image (1536px)
- **Final 4K**: ~$0.12 per image (batch mode)

Use the "Estimate Cost" button in the UI to calculate costs before processing.

## Settings

Access settings via the gear icon in the top bar:

- **Keep EXIF**: Preserve metadata in output images (default: off)
- **Output Format**: PNG (lossless) or JPEG (smaller files)
- **Preview Width**: Target width for previews (default: 1536px)
- **Final Width**: Target width for finals (default: 4000px)
- **Concurrent Previews**: Number of parallel preview generations (default: 3)

## Troubleshooting

### "GEMINI_API_KEY not configured"

Make sure you've created a `.env` file with your API key. The key should not be in quotes.

### Images not appearing in gallery

Check that your input folder contains supported image formats: `.jpg`, `.jpeg`, `.png`, `.webp`, `.tiff`, `.tif`

### Batch job stuck

Batch jobs can take several minutes to complete. Use the CLI `status` command to check progress:

```bash
npm run afterglow status --run <runId>
```

### Preview generation fails

- Check your API key is valid
- Ensure you have internet connectivity
- Check the Gemini API quotas in Google Cloud Console

## License

Private use only. Not for distribution or sale.
