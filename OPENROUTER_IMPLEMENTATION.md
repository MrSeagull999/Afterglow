# OpenRouter Provider Implementation

## ✅ IMPLEMENTATION COMPLETE

OpenRouter has been added as the primary alternative to Official Google Gemini for image generation. Laozhang provider has been deprecated.

---

## 📋 SUMMARY OF CHANGES

### Files Created (1)
1. **`/src/main/core/providers/OpenRouterProvider.ts`** - New OpenRouter provider implementation

### Files Modified (5)
1. **`/src/main/core/providers/LaozhangProvider.ts`** - Marked as @deprecated
2. **`/src/main/core/providers/providerRouter.ts`** - Replaced Laozhang with OpenRouter
3. **`/src/main/core/settings.ts`** - Updated ImageProvider type: 'google' | 'openrouter'
4. **`/src/main/core/modules/shared/generateService.ts`** - Updated priority mode checks
5. **`/src/renderer/components/settings/ProviderSettings.tsx`** - Updated UI for OpenRouter

### Files Deprecated (1)
1. **`/src/main/core/providers/LaozhangProvider.ts`** - Kept for reference, not accessible at runtime

---

## 🔧 ENVIRONMENT VARIABLES

Add these to your `.env` file:

```bash
# Provider Selection (default: google)
IMAGE_PROVIDER=google

# Official Google Gemini
GEMINI_API_KEY=your_gemini_api_key_here

# OpenRouter (alternative provider)
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Optional: Model defaults
IMAGE_PREVIEW_MODEL=gemini-3-pro-image-preview
IMAGE_PROVIDER_PRIORITY=true
```

---

## 🎯 PROVIDER DETAILS

### Official Google Gemini (Default)
- **Direct connection** to Google's Gemini API
- **Default provider** - no configuration needed beyond API key
- **Recommended** for most users
- Uses existing proven implementation

### OpenRouter (Alternative)
- **Routes Gemini requests** through OpenRouter infrastructure
- **Third-party routing layer** - see warning below
- **OpenAI-compatible API** format
- **Synchronous requests** - no async queueing
- **Priority mode** available (optional)

---

## 📝 CURATED MODEL LIST

The following models are available in both providers:

1. **gemini-3-pro-image-preview** ⭐ (Recommended, Default)
2. gemini-3-flash-preview
3. gemini-3-pro-preview
4. gemini-3-flash-preview-thinking
5. gemini-3-pro-preview-thinking
6. gemini-3-flash-preview-nothinking

Plus an "Advanced Custom Model" text input for custom model strings.

---

## 🔒 PRIVACY & SECURITY

### Hard Guarantees (Unchanged)
✅ **No sensitive filenames** sent to any provider  
✅ **No job addresses** sent to any provider  
✅ **No job names** sent to any provider  
✅ **Only sanitized data**: jobId, assetId, sanitizedName, image bytes, prompt

### OpenRouter Warning
⚠️ **Third-party routing layer.** Do not include sensitive or identifying data in prompts.  
OpenRouter routes requests through their infrastructure.

Both providers receive **identical sanitized inputs** - no difference in privacy handling.

---

## 🚀 QUICK START

### 1. Configure Environment Variables

Edit your `.env` file:

```bash
# Use Official Gemini (default)
IMAGE_PROVIDER=google
GEMINI_API_KEY=your_key_here

# OR use OpenRouter
IMAGE_PROVIDER=openrouter
OPENROUTER_API_KEY=your_key_here
```

### 2. Restart Application

Changes to `.env` require application restart.

### 3. Verify Provider Selection

Check logs on first generation:
```
[OpenRouterProvider] Generating with model: gemini-3-pro-image-preview
```

---

## 🧪 MANUAL TESTING CHECKLIST

### Basic Functionality
- [ ] **Default behavior**: Gemini works without any changes
- [ ] **Switch to OpenRouter**: Set `IMAGE_PROVIDER=openrouter` in `.env`
- [ ] **Generate preview**: Verify OpenRouter generates images correctly
- [ ] **Generate final**: Verify final generation works
- [ ] **Model switching**: Test each curated model
- [ ] **Custom model**: Test advanced custom model input
- [ ] **Priority mode**: Enable/disable priority mode (OpenRouter only)

### Provider Switching
- [ ] **Gemini → OpenRouter**: Switch providers, verify generation works
- [ ] **OpenRouter → Gemini**: Switch back, verify Gemini still works
- [ ] **Settings UI**: Verify provider selection UI shows correct state
- [ ] **Warning message**: Verify warning appears for OpenRouter

### Privacy Verification
- [ ] **Network monitor**: Verify no filenames in API requests
- [ ] **Logs**: Verify logs use only jobId/assetId
- [ ] **Both providers**: Verify both receive identical sanitized inputs

### Error Handling
- [ ] **Invalid API key**: Test with wrong key
- [ ] **Invalid model**: Test with non-existent model name
- [ ] **Network error**: Test with network disconnected
- [ ] **Missing env var**: Test without API key configured

### Rollback
- [ ] **Env var rollback**: Set `IMAGE_PROVIDER=google`, verify works
- [ ] **Settings rollback**: Change provider in UI, verify works
- [ ] **Full rollback**: Verify Gemini works exactly as before

---

## 🔄 ROLLBACK INSTRUCTIONS

### Method 1: Environment Variable (Instant)

Edit `.env`:
```bash
IMAGE_PROVIDER=google
```

Restart application. **This immediately restores default Gemini behavior.**

### Method 2: Settings UI

1. Open Settings
2. Select "Official Google Gemini"
3. Save settings
4. Restart application

### Method 3: Git Revert

```bash
# Find the commit
git log --oneline | grep -i openrouter

# Revert the commit
git revert <commit-hash>

# Or hard reset (if not pushed)
git reset --hard HEAD~1
```

### Method 4: Manual File Restoration

If needed, restore these files from git:
- `/src/main/core/providers/providerRouter.ts`
- `/src/main/core/settings.ts`
- `/src/main/core/modules/shared/generateService.ts`
- `/src/renderer/components/settings/ProviderSettings.tsx`

Delete:
- `/src/main/core/providers/OpenRouterProvider.ts`

---

## 📊 IMPLEMENTATION DETAILS

### OpenRouter API Format

OpenRouter uses OpenAI-compatible format:

```typescript
POST https://openrouter.ai/api/v1/chat/completions

Headers:
- Content-Type: application/json
- Authorization: Bearer {OPENROUTER_API_KEY}
- HTTP-Referer: https://afterglow.studio
- X-Title: Afterglow Studio

Body:
{
  "model": "gemini-3-pro-image-preview",
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "prompt" },
      { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } }
    ]
  }],
  "response_format": { "type": "image" },
  "max_tokens": 1000,
  "seed": 12345 // optional
}
```

### Provider Router Logic

```typescript
// Priority: env var > settings > default
const provider = process.env.IMAGE_PROVIDER || settings.imageProvider || 'google'

if (provider === 'openrouter') {
  return new OpenRouterProvider(
    process.env.OPENROUTER_API_KEY,
    process.env.OPENROUTER_BASE_URL
  )
}

// Default to Google Gemini
return new GoogleGeminiProvider(process.env.GEMINI_API_KEY)
```

### Priority Mode

Priority mode is only available for OpenRouter:

```typescript
priorityMode: settings.previewPriorityMode && settings.imageProvider === 'openrouter'
```

When enabled, requests priority routing for faster generation.

---

## 🗑️ LAOZHANG DEPRECATION

### What Changed
- **Marked as @deprecated** in code
- **Removed from provider enum**: 'google' | 'openrouter' (was 'google' | 'laozhang')
- **Removed from Settings UI**: No longer selectable
- **Removed from provider router**: Cannot be selected at runtime
- **File kept for reference**: Code preserved but inaccessible

### Reason for Deprecation
Deprecated due to payment processing and compliance constraints.  
Replaced by OpenRouter which provides better routing and reliability.

### Migration Path
If you were using Laozhang:
1. Set `IMAGE_PROVIDER=openrouter` in `.env`
2. Add `OPENROUTER_API_KEY` to `.env`
3. Remove `LAOZHANG_API_KEY` from `.env` (optional cleanup)

---

## 🔍 TROUBLESHOOTING

### "OpenRouter API key not configured"
**Solution:** Add `OPENROUTER_API_KEY` to `.env` file

### "API error 401: Unauthorized"
**Solution:** Verify OpenRouter API key is correct

### "Model not found"
**Solution:** Verify model name is correct for OpenRouter

### "Generation fails with OpenRouter but works with Gemini"
**Solution:** Check OpenRouter API status, try different model

### "Priority mode not working"
**Solution:** Priority mode only works with OpenRouter provider

### "Settings UI shows old provider"
**Solution:** Restart application after changing `.env`

---

## 📈 PERFORMANCE NOTES

### OpenRouter vs Gemini
- **Latency**: OpenRouter adds routing overhead (~100-500ms)
- **Reliability**: Both providers are reliable
- **Cost**: Check OpenRouter pricing vs direct Gemini
- **Priority mode**: May reduce latency for OpenRouter

### Recommendations
- **Use Gemini** for lowest latency (default)
- **Use OpenRouter** if you need their routing features
- **Enable priority mode** for OpenRouter if available

---

## 🎓 TECHNICAL NOTES

### Provider Abstraction
All providers implement `IImageProvider` interface:
```typescript
interface IImageProvider {
  name: string
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse>
  isConfigured(): boolean
}
```

### Synchronous Requests
Both providers use synchronous request/response:
- No async queueing
- No polling for results
- Direct response with image data

### Error Handling
Both providers return standardized error format:
```typescript
{
  success: false,
  error: "Error message"
}
```

### Logging
All logs use privacy-safe format:
```typescript
console.log(`Generating for job:${jobId} asset:${assetId} version:${versionId}`)
// Never: console.log(`Generating for ${filename}`)
```

---

## 📞 SUPPORT

### Common Issues
1. **API Key Issues**: Check `.env` file has correct key
2. **Provider Selection**: Verify `IMAGE_PROVIDER` env var
3. **Model Issues**: Use curated models from dropdown
4. **Network Issues**: Check internet connection and API status

### Debug Mode
Enable verbose logging:
```typescript
console.log('[Provider] Selected:', provider.name)
console.log('[Provider] Model:', model)
console.log('[Provider] Base URL:', baseUrl)
```

### Getting Help
1. Check this documentation
2. Review testing checklist
3. Try rollback instructions
4. Check OpenRouter API status
5. Contact development team

---

## ✨ SUMMARY

### What's New
✅ OpenRouter provider added as alternative to Gemini  
✅ Environment variable configuration  
✅ Curated model list (6 models)  
✅ Advanced custom model input  
✅ Priority mode for OpenRouter  
✅ Laozhang provider deprecated  

### What's Unchanged
✅ Default behavior (Gemini)  
✅ Privacy guarantees  
✅ Filename sanitization  
✅ Module logic  
✅ Asset storage  
✅ Existing Gemini functionality  

### Migration Required
⚠️ If using Laozhang: Switch to OpenRouter  
✅ If using Gemini: No changes needed  

---

**Implementation Date:** 2026-01-03  
**Status:** ✅ COMPLETE  
**Default Provider:** Official Google Gemini  
**Alternative Provider:** OpenRouter  
**Deprecated Provider:** Laozhang (kept for reference)
