# Style Reference Implementation for Lighting

## Overview
Request to add style reference capability to the Nano Banana pipeline for lighting control, similar to node-based applications.

## Current State
- Twilight module uses text prompts to control lighting conditions
- Lighting condition toggles (Overcast/Sunny) modify prompt behavior
- No image-based style reference capability

## Proposed Implementation

### Style Reference Images
Allow users to upload reference images that demonstrate desired lighting characteristics:
- **Twilight examples**: Blue hour sky gradients, interior warmth levels
- **Time of day references**: Golden hour, midday, dusk
- **Mood references**: Dramatic vs subtle lighting

### Technical Approach

#### Option 1: Image Conditioning (Preferred)
- Use image-to-image models with style reference conditioning
- Models like Flux or Stable Diffusion XL support style reference inputs
- Pass reference image alongside source image to guide lighting transformation

#### Option 2: Prompt Enhancement
- Analyze reference image to extract lighting characteristics
- Generate enhanced prompts based on detected lighting properties
- Color temperature, contrast ratios, shadow softness, etc.

#### Option 3: ControlNet/IP-Adapter
- Use ControlNet for structural preservation
- IP-Adapter for style transfer from reference image
- Maintains composition while adopting reference lighting

### Integration Points

1. **UI Enhancement**
   - Add style reference upload to TwilightPanel
   - Display reference thumbnail alongside preset selection
   - Allow multiple reference images with weighting

2. **Backend Processing**
   - Store reference images in job assets
   - Pass reference image paths to generation pipeline
   - Modify prompt assembly to incorporate style guidance

3. **Preset System**
   - Allow presets to include default style references
   - Users can override with custom references
   - Build library of curated lighting reference images

### Benefits
- More precise control over lighting aesthetics
- Reduces trial-and-error with text prompts
- Easier for non-technical users to communicate desired look
- Consistent results across similar properties

### Implementation Priority
- **Phase 1**: Research model capabilities (Flux, SDXL with IP-Adapter)
- **Phase 2**: Prototype with single reference image
- **Phase 3**: UI integration and multi-reference support
- **Phase 4**: Build curated reference library

### Node-Based Apps Reference
You mentioned seeing this in a node-based app - likely:
- **ComfyUI**: Supports IP-Adapter and style reference nodes
- **Fooocus**: Has style reference feature built-in
- **Invoke AI**: Canvas with style reference capabilities

These can serve as UX inspiration for implementation.

## Notes
- Style references work best when combined with strong structural preservation
- May need to balance style transfer strength to avoid over-application
- Consider allowing users to adjust style reference weight (0-100%)
