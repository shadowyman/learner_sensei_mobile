# Mobile Input Send Button Ring Artifact

## Status

Open. Documented during iOS simulator debugging on 2026-06-04.

## Summary

The mobile input bar send button does not render its intended nested circular button treatment correctly. The visible button appears as one outer translucent/dark circle with a white triangular send/play icon, plus a tiny green/cyan square or dot above the icon. The expected visual is a larger send button circle with a visible inner circular ring around the icon.

The artifact is visually small, around a 1px-radius mark, and appears above the send icon. After changing the intended inner ring implementation, the artifact moved but did not become the expected inner ring. This strongly suggests the tiny mark is either not the intended ring, or the ring is not being painted in the expected layer/size.

## Observed Evidence

- The send button appears visually smaller than its declared frame.
- The code editor badge near the send button appears similar in size or larger, even though the send button's declared outer frame is larger.
- Screenshot evidence showed:
  - A visible outer send circle.
  - A white triangular send/play icon.
  - A tiny green/cyan square/dot above the icon.
  - No visible 34px inner circle around the icon after the latest ring refactor.
- The tiny artifact persisted after changing the ring from an absolute-positioned sibling to a normal child wrapper around the icon.
- The artifact shifted position after the wrapper change, but its visible size did not meaningfully change.

## Current Relevant Code

Primary file:

- `SenseiMobile/src/mobile/components/InputBar.tsx`

Related component:

- `SenseiMobile/src/mobile/components/SendIconSkia.tsx`
- `SenseiMobile/src/mobile/components/CodeEditorBadge.tsx`

Current send button structure in `InputBar.tsx`:

```tsx
<TouchableOpacity style={[styles.sendButton, disabled && styles.sendButtonDisabled]}>
  <View style={[styles.sendLayerBase, { backgroundColor: sendBaseColor }]} />
  <LinearGradient
    colors={sendGradientColors}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={[styles.sendGradient, { borderColor: sendBorderColor }]}
  />
  <View style={[styles.sendIconWell, { borderColor: innerRingColor }]}>
    <SendIconSkia size={14} />
  </View>
</TouchableOpacity>
```

Current send button sizing after debugging changes:

```ts
sendButton: {
  width: 44,
  height: 44,
  borderRadius: 22,
  position: 'relative'
}

sendLayerBase: {
  ...StyleSheet.absoluteFillObject,
  borderRadius: 22
}

sendGradient: {
  ...StyleSheet.absoluteFillObject,
  borderRadius: 22,
  borderWidth: 1.5
}

sendIconWell: {
  width: 34,
  height: 34,
  borderRadius: 17,
  borderWidth: 1,
  alignItems: 'center',
  justifyContent: 'center'
}
```

Current send icon:

```tsx
<SendIconSkia size={14} />
```

The icon size was intentionally not changed during the last debugging pass.

## Important Correction

The code editor badge was initially described as 22px because `CodeEditorBadge` defaults to:

```ts
const DEFAULT_SIZE = 22;
```

However, the actual input bar usage passes:

```ts
const editorSize = 26;
```

and renders:

```tsx
<CodeEditorBadge size={editorSize} />
```

So the editor badge is `26 x 26` in the input bar, not `22 x 22`.

## What Has Been Tried

1. Increased the send button outer frame:

```ts
width: 38 -> 44
height: 38 -> 44
borderRadius: 19 -> 22
```

2. Increased the gradient border width:

```ts
borderWidth: 1 -> 1.5
```

3. Changed the inner ring from edge-based absolute sizing:

```ts
position: 'absolute'
left: 5
right: 5
top: 5
bottom: 5
borderRadius: 17
```

to an explicit centered wrapper:

```ts
width: 34
height: 34
borderRadius: 17
alignItems: 'center'
justifyContent: 'center'
```

4. Left `SendIconSkia size={14}` unchanged per user request.

## What Those Attempts Proved

- The bug is not just that the send button's declared outer frame is too small.
- The bug is not solved by changing the inner ring from an absolute sibling to a normal wrapper child.
- Because the tiny artifact moved but did not resize into the expected 34px circle, the tiny artifact may not be the intended inner ring.
- The artifact may be coming from a different layer, such as the nearby `CodeEditorBadge` overlay, a Skia canvas artifact, or a gradient/border layer.
- The current visual problem should be debugged as a layer identity and paint-order issue, not as a simple size tweak.

## Leading Hypotheses

1. The tiny green/cyan mark is not the send inner ring at all.
   - It may be part of the overlaid `CodeEditorBadge`, because that badge is positioned partly above/right of the send button.
   - The editor badge uses `borderColorOverride={innerRingColor}`, which could explain a similarly colored artifact.

2. The intended inner ring has valid layout but is visually hidden.
   - The ring may be too low contrast against the gradient/base layers.
   - The ring may be covered by another layer or not painted as expected inside `TouchableOpacity`.

3. The absolute fill gradient/base layers may be interfering with child paint order.
   - `sendLayerBase` and `sendGradient` both use `StyleSheet.absoluteFillObject`.
   - The normal child `sendIconWell` should render above them, but the observed result does not prove that the ring is visible.

4. The Skia send icon or canvas may be contributing an artifact.
   - `SendIconSkia` renders a `Canvas` with a translated `Group`.
   - The visible white triangle renders, but the tiny mark could still come from an unrelated Skia or border artifact.

5. The theme-derived colors may be invalid or visually collapsing.
   - `innerRingColor` is derived from `themeColors`.
   - The editor badge uses the same `innerRingColor` as a border override.
   - Send button colors appear less responsive to theme changes than the editor badge, according to visual observation.

## Next Controlled Debug Steps

Do not continue blind size tweaks. Run these checks in order:

1. Temporarily hide `CodeEditorBadge`.
   - If the tiny dot disappears, the artifact belongs to the editor badge overlay, not the send button ring.

2. Force the send inner ring to a high-contrast diagnostic style.
   - Example: red border, width 34, height 34, border width 2, optional faint red background.
   - If a 34px red ring appears, the geometry is valid and the production `innerRingColor` is the problem.

3. If the red ring still does not appear, temporarily disable `sendGradient`.
   - This checks whether the gradient layer is covering or interfering with the ring.

4. Add `onLayout` diagnostics for:
   - send button
   - send icon well
   - editor overlay
   - code editor badge, if needed

Expected layout values:

```ts
sendButton: 44 x 44
sendIconWell: 34 x 34
editorOverlay child badge: 26 x 26
```

5. If RN view layering remains unreliable, draw the send button ring and icon together in Skia.
   - One canvas and one coordinate system would remove the ambiguity from nested RN absolute layers.

## Related Context

This issue was discovered during the iOS Liquid Glass input bar/selection toolbar debugging pass. The Liquid Glass work itself is separate:

- Liquid Glass is active on iOS 26.
- The input bar glass works when `LiquidGlassView` is used as a container around the `TextInput`.
- The selection toolbar glass works when it is mounted only after layout is available.

The send button artifact is a separate visual layering/sizing bug inside the input bar actions area.
