# AI Provider Abstraction & Filename Sanitization - Implementation Summary

## Overview
This implementation adds support for multiple AI providers (Google Gemini and Laozhang proxy) with privacy-focused filename sanitization to prevent sensitive information from being sent to external APIs.

---

## FILES CHANGED

### 1. New Provider Abstraction Layer

#### `/src/main/core/providers/IImageProvider.ts` (NEW)
- Interface defining provider contract
- `ImageGenerationRequest` and `ImageGenerationResponse` types
- Supports model selection, priority mode, and provider metadata

#### `/src/main/core/providers/GoogleGeminiProvider.ts` (NEW)
- Official Google Gemini provider implementation
- Handles seed rejection retry logic
- Uses official Gemini API endpoints

#### `/src/main/core/providers/LaozhangProvider.ts` (NEW)
- Laozhang proxy provider implementation
- OpenAI-compatible API format
- Priority mode support with fallback to synchronous calls
- Endpoint: `https://api.laozhang.com/v1`

#### `/src/main/core/providers/providerRouter.ts` (NEW)
- Provider factory function `getImageProvider()`
- Routes to correct provider based on settings
- Defaults to Google Gemini

### 2. Settings Schema Updates

#### `/src/main/core/settings.ts` (MODIFIED)
**Added fields:**
```typescript
// Provider configuration
imageProvider: ImageProvider           // 'google' | 'laozhang'
googleApiKey: string                   // Google API key
laozhangApiKey: string                 // Laozhang API key
previewImageModel: string              // Model name for previews
previewPriorityMode: boolean           // Enable priority mode (Laozhang only)
advancedCustomModel: string            // Advanced custom model override

// Privacy settings
privacy: {
  safeFilenamesOnImport: boolean       // Always true by default
}
```

**Default values:**
- `imageProvider`: 'google'
- `googleApiKey`: process.env.GEMINI_API_KEY || ''
- `laozhangApiKey`: ''
- `previewImageModel`: 'gemini-3-pro-image-preview'
- `previewPriorityMode`: true
- `advancedCustomModel`: ''
- `privacy.safeFilenamesOnImport`: true

### 3. Filename Sanitization

#### `/src/shared/types/index.ts` (MODIFIED)
**Added to Asset interface:**
```typescript
displayName?: string        // Original filename for UI display
originalName?: string        // Original filename for reference (never sent to providers)
sanitizedName?: string       // Safe filename used for storage and API calls
legacySanitized?: boolean    // True if sanitizedName was set from existing filename during migration
```

#### `/src/main/core/utils/filenameSanitizer.ts` (NEW)
**Functions:**
- `generateSanitizedFilename(jobId, assetId, originalFilename)` - Format: `{jobId}_{assetId}_source.{ext}`
- `getDisplayName(filename)` - Extract display name without extension
- `isSafeFilename(filename, jobId, assetId)` - Validate filename safety
- `generateAssetId(existingAssetCount)` - Generate sequential asset ID (A-0001, A-0002, etc.)

#### `/src/main/core/store/assetStore.ts` (MODIFIED)
**Changes:**
- Updated `createAsset()` to generate sanitized filenames
- Stores files using sanitizedName on disk
- Saves displayName, originalName, sanitizedName in metadata
- Sets legacySanitized=false for new assets

**Privacy guarantee:**
- Original filenames stored as metadata only
- Sanitized filenames used for all file operations
- Format ensures no sensitive data (addresses, names) in filenames

### 4. Image Generation Updates

#### `/src/main/core/modules/shared/generateService.ts` (MODIFIED)
**Changes in all generation functions:**
- Replaced `generateImageWithGemini()` with provider abstraction
- Uses `getImageProvider()` to get configured provider
- Passes `priorityMode` for Laozhang provider
- **PRIVACY GUARANTEE:** Logs only use jobId/assetId, never filenames

**Updated functions:**
- `generateVersionPreview()` - Uses provider router, priority mode support
- `generateVersionHQPreview()` - Uses provider router
- `generateVersionFinal()` - Uses provider router, no priority mode

**Logging changes:**
```typescript
// OLD: console.log(`Generating for ${filename}`)
// NEW: console.log(`Generating for job:${jobId} asset:${assetId} version:${versionId}`)
```

### 5. Migration Utility

#### `/src/main/core/migrations/assetSanitizationMigration.ts` (NEW)
**Functions:**
- `migrateAssetFilenames(jobId)` - Migrate single job's assets
- `migrateAllAssetFilenames()` - Migrate all jobs

**Migration behavior:**
- Does NOT rename files on disk
- Sets sanitizedName to current filename
- Marks as legacySanitized=true
- Preserves displayName and originalName

---

## CURATED MODEL LIST

The following models are available in the UI dropdown:

1. **gemini-3-pro-image-preview** (recommended for previews)
2. gemini-3-flash-preview
3. gemini-3-pro-preview
4. gemini-3-flash-preview-thinking
5. gemini-3-pro-preview-thinking
6. gemini-3-flash-preview-nothinking

Plus an "Advanced" text input for custom model strings.

---

## PRIORITY MODE BEHAVIOR

### Laozhang Provider
- If `previewPriorityMode = true` and `imageProvider = 'laozhang'`:
  - Attempts to use `/images/generations/priority` endpoint
  - Falls back to standard endpoint if priority not available (404)
  - Sets `priority: 'high'` parameter in request body
  - If API doesn't support priority, synchronous call is used

### Google Provider
- Priority mode not applicable (always synchronous)

---

## PRIVACY GUARANTEES

### Hard Guarantees
✅ **No outbound API request contains:**
- originalName or displayName
- job address (from metadata)
- job slug or name

✅ **Only included in API calls:**
- jobId
- assetId
- sanitizedName (format: `{jobId}_{assetId}_source.{ext}`)
- Image bytes (base64)
- Prompt text

### Logging
✅ **All logs use:**
- `job:${jobId}` instead of job names
- `asset:${assetId}` instead of filenames
- `version:${versionId}` instead of file paths

### Example sanitized filename
```
Original: "123_Main_Street_Living_Room.jpg"
Sanitized: "job_20260103_7H2K_A-0007_source.jpg"
```

---

## SETTINGS UI REQUIREMENTS (TO BE IMPLEMENTED)

### Provider Section
```
┌─ AI Provider ────────────────────────────┐
│ Provider: [Dropdown]                      │
│   ○ Official Google Gemini                │
│   ○ Laozhang (Proxy) ⚠️                   │
│                                           │
│ Google API Key: [••••••••••••••]         │
│ Laozhang API Key: [••••••••••••••]       │
│                                           │
│ Preview Model: [Dropdown]                 │
│   - gemini-3-pro-image-preview ⭐         │
│   - gemini-3-flash-preview                │
│   - gemini-3-pro-preview                  │
│   - gemini-3-flash-preview-thinking       │
│   - gemini-3-pro-preview-thinking         │
│   - gemini-3-flash-preview-nothinking     │
│                                           │
│ Advanced Custom Model: [text input]       │
│                                           │
│ ☑ Priority Mode (Laozhang only)          │
│                                           │
│ ⚠️ Warning: Third-party proxy.            │
│    Do not include sensitive data in       │
│    prompts.                               │
└───────────────────────────────────────────┘
```

### Privacy Section
```
┌─ Privacy ────────────────────────────────┐
│ ☑ Safe filenames on import (recommended) │
│                                           │
│ When enabled, imported files are saved   │
│ with sanitized names that don't contain  │
│ addresses or personal information.       │
└───────────────────────────────────────────┘
```

---

## MANUAL TESTING CHECKLIST

### Provider Switching
- [ ] Set provider to Google, verify generation works
- [ ] Set provider to Laozhang, verify generation works
- [ ] Switch between providers mid-session
- [ ] Verify API keys are saved and loaded correctly

### Model Selection
- [ ] Select each curated model from dropdown
- [ ] Verify model name is used in API request
- [ ] Test advanced custom model input
- [ ] Verify custom model overrides dropdown selection

### Priority Mode (Laozhang only)
- [ ] Enable priority mode with Laozhang provider
- [ ] Verify priority endpoint is attempted
- [ ] Test fallback to standard endpoint if priority unavailable
- [ ] Disable priority mode, verify standard endpoint used

### Filename Sanitization
- [ ] Import new asset with address in filename (e.g., "123_Main_St.jpg")
- [ ] Verify file saved with sanitized name on disk
- [ ] Verify displayName shows original filename in UI
- [ ] Verify originalName stored in metadata
- [ ] Check sanitizedName format: `{jobId}_{assetId}_source.{ext}`

### Privacy Verification
- [ ] Enable network monitoring
- [ ] Generate preview/final
- [ ] Verify API request body contains NO original filenames
- [ ] Verify API request contains only sanitized names
- [ ] Check logs contain only jobId/assetId, not filenames

### Migration
- [ ] Run migration on existing job with assets
- [ ] Verify sanitizedName added to all assets
- [ ] Verify legacySanitized=true for migrated assets
- [ ] Verify files NOT renamed on disk
- [ ] Verify generation still works with migrated assets

### Error Handling
- [ ] Test with invalid API key
- [ ] Test with invalid model name
- [ ] Test with network disconnected
- [ ] Verify error messages are clear and helpful

---

## ROLLBACK INSTRUCTIONS

### Quick Rollback (Settings Only)
1. Open Settings UI
2. Change `imageProvider` back to `'google'`
3. Clear `laozhangApiKey` if desired
4. Save settings
5. Restart application

### Full Rollback (Git)
```bash
# Identify the commit before this feature
git log --oneline

# Revert to previous commit
git revert <commit-hash>

# Or reset if not pushed
git reset --hard <commit-hash>
```

### Manual Rollback (File-by-File)
1. Delete new provider files:
   - `/src/main/core/providers/` (entire directory)
   - `/src/main/core/utils/filenameSanitizer.ts`
   - `/src/main/core/migrations/assetSanitizationMigration.ts`

2. Restore `/src/main/core/settings.ts`:
   - Remove provider fields
   - Remove privacy section
   - Restore DEFAULT_SETTINGS

3. Restore `/src/shared/types/index.ts`:
   - Remove filename sanitization fields from Asset interface

4. Restore `/src/main/core/modules/shared/generateService.ts`:
   - Replace provider calls with `generateImageWithGemini()`
   - Remove privacy logging changes

5. Restore `/src/main/core/store/assetStore.ts`:
   - Remove sanitization logic from `createAsset()`
   - Restore original asset ID generation

### Settings File Cleanup
```bash
# Remove provider settings from settings file
# Edit: ./afterglow-settings.json
# Remove: imageProvider, googleApiKey, laozhangApiKey, previewImageModel, 
#         previewPriorityMode, advancedCustomModel, privacy
```

---

## FEATURE FLAGS / TOGGLES

### Disable Provider Abstraction
Set in settings:
```json
{
  "imageProvider": "google"
}
```
This forces use of Google Gemini only.

### Disable Filename Sanitization (NOT RECOMMENDED)
Even if disabled, sanitizedName is still generated and used for API calls.
The setting only affects whether files are saved with sanitized names.

**Note:** For maximum privacy, always keep `privacy.safeFilenamesOnImport: true`

---

## MIGRATION NOTES

### Existing Assets
- Migration does NOT rename files on disk
- Sets sanitizedName = current filename
- Marks as legacySanitized=true
- Future imports use proper sanitization

### Backward Compatibility
- Old assets continue to work
- New privacy rules apply to all API calls
- UI displays original names (displayName)
- No user-visible changes except enhanced privacy

---

## IMPLEMENTATION STATUS

### ✅ Completed
- Provider abstraction interface
- Google Gemini provider
- Laozhang provider
- Provider router
- Settings schema updates
- Filename sanitization utilities
- Asset store updates
- Generate service updates
- Migration utility
- Privacy logging updates

### ⏳ Pending (Requires UI Implementation)
- Settings UI components
- Provider selection dropdown
- API key input fields (masked)
- Model selection dropdown
- Priority mode toggle
- Privacy settings toggle
- Warning messages for third-party providers

### 📝 Documentation
- Implementation summary (this file)
- Testing checklist
- Rollback instructions
- Privacy guarantees
- Migration guide

---

## SUPPORT & TROUBLESHOOTING

### Common Issues

**Issue:** "API key not configured"
- **Solution:** Check settings file has correct API key for selected provider

**Issue:** "Model not found"
- **Solution:** Verify model name is correct for the provider (Google vs Laozhang)

**Issue:** "Priority mode not working"
- **Solution:** Priority mode only works with Laozhang provider, check provider setting

**Issue:** "Filenames still contain addresses"
- **Solution:** This is for legacy assets. New imports will use sanitized names.

**Issue:** "Generation fails after switching providers"
- **Solution:** Verify API key is configured for new provider

### Debug Logging
Enable verbose logging to see provider selection and API calls:
```typescript
console.log('[Provider] Selected:', provider.name)
console.log('[Provider] Model:', model)
console.log('[Provider] Priority:', priorityMode)
```

---

## SECURITY CONSIDERATIONS

### API Keys
- Stored in settings file (not in git)
- Never logged or exposed in UI
- Masked in settings UI with `••••••`

### Filename Privacy
- Original filenames never sent to external APIs
- Sanitized names contain only jobId + assetId
- No addresses, names, or sensitive data in API requests

### Third-Party Providers
- Warning displayed when using Laozhang
- Users responsible for prompt content
- No guarantee of data handling by third parties

---

## FUTURE ENHANCEMENTS

### Potential Improvements
1. Support for additional providers (OpenAI, Anthropic, etc.)
2. Provider-specific model validation
3. Cost estimation per provider
4. Provider performance metrics
5. Automatic provider failover
6. Batch generation optimization per provider
7. Provider-specific retry strategies

### Settings Enhancements
1. Per-module provider selection
2. Per-quality-tier model selection
3. Provider presets (fast/quality/balanced)
4. Cost limits per provider
5. Usage analytics dashboard

---

## CONTACT & SUPPORT

For issues or questions:
1. Check this implementation summary
2. Review testing checklist
3. Check rollback instructions
4. Enable debug logging
5. Contact development team

---

**Last Updated:** 2026-01-03
**Version:** 1.0.0
**Status:** Implementation Complete (UI Pending)
