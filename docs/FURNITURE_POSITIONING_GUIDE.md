# Furniture Positioning Guide for Virtual Staging

## Problem
AI models sometimes ignore specific furniture placement instructions (e.g., "bed against right wall") and instead center furniture in the room or place it arbitrarily.

## Solution
The base prompt now includes explicit furniture positioning guidance that teaches the AI how to interpret wall placement requests.

---

## Wall Identification System

When specifying furniture placement in **Custom Instructions**, use these wall identifiers:

- **BACK WALL** - The wall facing the camera (visible in the background)
- **LEFT WALL** - The wall on the left side of the image
- **RIGHT WALL** - The wall on the right side of the image

---

## Custom Instructions Examples

### Bedrooms

**Example 1: Bed on Right Wall**
```
Place bed headboard against RIGHT WALL
```

**Example 2: Bed on Left Wall**
```
Position bed with headboard against LEFT WALL
```

**Example 3: Bed on Back Wall**
```
Place bed headboard against BACK WALL (facing camera)
```

### Living Rooms

**Example 1: Sofa Against Back Wall**
```
Position sofa against BACK WALL facing into the room
```

**Example 2: Sofa on Side Wall**
```
Place sofa along RIGHT WALL with coffee table in front
```

### Dining Rooms

**Example 1: Table Centered**
```
Center dining table in the room with chairs around it
```

**Example 2: Table Against Wall**
```
Position dining table against LEFT WALL with chairs on three sides
```

---

## Built-in Positioning Rules

The base prompt now includes these automatic rules:

### For Bedrooms:
- Bed headboards should be placed **against walls**, not floating in the center
- When a wall is specified, the headboard goes against that wall
- Nightstands should flank the bed on either side

### For All Rooms:
- Furniture should be positioned **against walls or in logical arrangements**
- Furniture should NOT be arbitrarily centered unless specifically requested
- Follow custom instructions precisely when wall placement is specified

---

## Camera Angle Preservation

**Critical Rule:** The camera angle, perspective, and viewpoint must remain **EXACTLY the same** as the input image.

The AI is now explicitly instructed to:
- NOT shift, rotate, zoom, or change camera position
- Maintain the exact same view of the room
- Keep the same perspective and framing

This prevents the AI from "adjusting" the camera to better show furniture, which can make the output look different from the input.

---

## Best Practices

### ✅ DO:
- Use clear wall identifiers (BACK WALL, LEFT WALL, RIGHT WALL)
- Specify headboard placement for beds
- Request furniture "against" walls when you want it positioned there
- Use "centered" explicitly if you want centered placement

### ❌ DON'T:
- Use ambiguous terms like "on the side" (which side?)
- Assume the AI will place furniture against walls by default
- Use compass directions (north, south) - the AI doesn't know room orientation

---

## Troubleshooting

### Issue: Bed is centered instead of against the wall
**Solution:** Add to Custom Instructions:
```
Place bed headboard against RIGHT WALL (not centered in room)
```

### Issue: Sofa is floating in the middle of the room
**Solution:** Add to Custom Instructions:
```
Position sofa against BACK WALL facing into the room
```

### Issue: Furniture placement ignores my instructions
**Solution:** 
1. Use explicit wall identifiers (BACK WALL, LEFT WALL, RIGHT WALL)
2. Add "not centered" or "not floating" to clarify
3. Specify what should be in front of or beside the furniture

### Issue: Camera angle changed in the output
**Solution:** This should now be prevented by the strengthened preservation rules. If it still occurs, report as a bug - the base prompt explicitly forbids camera changes.

---

## Technical Details

### How It Works

The base prompt includes this guidance:

```
FURNITURE POSITIONING GUIDANCE:
- When specific wall placement is requested in custom instructions (e.g., "bed against right wall"), 
  follow those instructions precisely.
- Identify walls by their position relative to the camera: BACK WALL (facing camera), 
  LEFT WALL (left side), RIGHT WALL (right side).
- For bedrooms: the bed headboard should be placed against the specified wall, 
  not floating in the center of the room.
- Furniture should be positioned against walls or in logical arrangements, 
  not arbitrarily centered unless specifically requested.
```

### Camera Preservation

```
CRITICAL: Maintain the EXACT same camera angle, perspective, and viewpoint as the input image. 
Do NOT shift, rotate, zoom, or change the camera position in any way. 
The output must show the same view of the room as the input.
```

---

## Example Custom Instructions

### Full Bedroom Example
```
Place bed headboard against RIGHT WALL. Add nightstands on both sides of bed. 
Position dresser against BACK WALL opposite the bed. Add area rug under bed extending to nightstands.
```

### Full Living Room Example
```
Position sofa against BACK WALL facing into room. Place coffee table in front of sofa. 
Add two accent chairs on LEFT WALL side facing the sofa. Position TV console on RIGHT WALL.
```

### Full Dining Room Example
```
Center dining table in the room with 6 chairs around it. Add sideboard against BACK WALL. 
Include area rug under table and chairs.
```

---

## Summary

The prompt system now includes:
- ✅ Explicit wall identification system (BACK/LEFT/RIGHT WALL)
- ✅ Furniture positioning guidance for bedrooms
- ✅ Instructions to follow custom placement requests precisely
- ✅ Rules against arbitrary centering of furniture
- ✅ Strengthened camera angle preservation
- ✅ Explicit prohibition of camera movement/rotation/zoom

Use clear, specific custom instructions with wall identifiers for best results.
