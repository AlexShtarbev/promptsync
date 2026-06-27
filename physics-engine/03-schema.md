# 03 — Schema reference

The central artifact. Everything else operates on this typed model. Expressed as TypeScript interfaces; persist in SQLite (one table per top-level entity, JSON columns for the nested state is fine for the MVP). These types are a starting point — refine during implementation, but keep the **tracked-state axes** (posture/contact/position/heldObjects/facing) first-class, because the lints depend on them.

## Identifiers

```ts
type ElementId = string   // e.g. "HaleS0", "Floor1Creature", "Floor1Chamber"
type ShotCode  = string   // e.g. "1A", "3C", "5G"  (existing convention)
type SceneId   = string
```

## Element library (canonical, slowly-changing)

```ts
type ElementKind = 'character' | 'creature' | 'environment' | 'prop'

interface Element {
  id: ElementId
  kind: ElementKind
  scope: 'global' | 'episode-local'     // matches series vs single-project layout
  canonRef?: string                       // link to bible/ canon doc (series)
}

interface CharacterElement extends Element {
  kind: 'character' | 'creature'
  build: BuildSpec                        // the anti-drift anchor (B2)
  wardrobe: WardrobeSpec
  identityClause: string                  // canonical face/hair description (positive)
  unflattering: boolean                   // if true, build clause is MANDATORY every visible shot
  concealmentDefault?: ConcealmentSpec    // e.g. creature: shadow-only
  referenceImages: RefImage[]             // for IP-Adapter / Kling Element (Tier 2)
}

interface BuildSpec {
  // POSITIVE, physical, present-tense — never adjectival-only
  summary: string                         // "noticeably overweight, ~180cm"
  positiveClauses: string[]               // ["heavy soft belly straining the stretched grey t-shirt", "thick neck", ...]
  forbidden: string[]                     // ["lean", "fit", "slimmed", "athletic"] — for the (weak) negative + the lint
}

interface EnvironmentElement extends Element {
  kind: 'environment'
  canonicalBlock: string                  // the "[World Plate]" anchor text
  screenAnchors: ScreenAnchor[]           // A7: where fixed features sit in frame
  palette: PaletteId
}

interface ScreenAnchor {
  feature: string                         // "red glow", "stairs", "floor counter"
  side: 'camera-left' | 'camera-right' | 'center' | 'background' | 'foreground'
  depth?: 'near' | 'mid' | 'far'
}
```

## Tracked physical state (the "physics")

```ts
type Contact  = 'standing' | 'kneeling' | 'seated' | 'grounded' | 'pinned' | 'prone' | 'supine'
type Facing   = 'to-camera' | 'away' | 'camera-left' | 'camera-right' | 'up' | 'down' | string

interface PhysicalState {
  position: string            // free-ish but canonicalized: "on the floor, lower-frame", "at the stair base"
  posture: string            // "propped on one elbow", "slumped", "standing to full height"
  contact: Contact           // first-class so lints can reason (pinned ≠ standing)
  heldObjects: ElementId[]   // e.g. ["StoneShard"]
  facing: Facing
  // derived/optional:
  notes?: string
}
```

`contact` is deliberately a closed enum: it is the axis that caught the worst bug (a `pinned`/`grounded` character rendered `standing`). Lints reason over it directly.

## Shot

```ts
type Framing = {
  angle: string              // "low-angle", "eye-level", "high"
  size: 'ECU'|'CU'|'MCU'|'MS'|'WS'|'FS'|'insert'|'POV'
  movement: string           // "static", "push-in", "tilt up"
  visibleBody: boolean       // false for face CU / insert → framing-aware emit (A4)
  aspect: '9:16' | '16:9' | '1:1'
}

interface Action {
  verb: string                       // "strike", "reach", "look-at", "flee", "rise", "climb", "speak"
  transitive: boolean                // does it act ON a target?
  targetElementId?: ElementId        // REQUIRED if transitive && not intentional-absence (L04)
  intentionalAbsence?: 'flee' | 'address-disembodied'  // the allowed exceptions
  effects?: StateDelta               // how this action changes the actor's closing state
}

interface Shot {
  code: ShotCode
  sceneId: SceneId
  order: number
  elements: ElementId[]              // everything in frame (incl. concealed targets!)
  subjectElements: ElementId[]       // the primary subject(s)
  framing: Framing
  durationS: number
  paletteGroup: PaletteId
  action: Action
  stateChanges: Record<ElementId, Partial<PhysicalState>>  // declared transitions for THIS shot
  concealment: ConcealmentSpec[]     // elements shown only as shadow/silhouette (B4)
  textOnScreen?: TextRef[]           // A6: references into the text registry
  // authored creative prose (LLM owns these; compiler weaves them in):
  prose: { mood: string; sceneAndMood: string; subjectAndAction: string; sfx: string; vo?: string }
  assetType: 'still' | 'kling' | 'seedance' | 'kling-reuse'
  platform: 'nanobanana' | 'kling' | 'seedance'
  startFrameShot?: ShotCode | null
  // optional manual override of a compiled block, itself linted against state:
  overrides?: Partial<NbPrompt>
}

interface StateDelta { contact?: Contact; heldObjectsAdd?: ElementId[]; heldObjectsRemove?: ElementId[]; facing?: Facing; position?: string; posture?: string }
```

## Concealment & text registry

```ts
interface ConcealmentSpec {
  elementId: ElementId
  positiveDescription: string     // "a shapeless black shadow-mass filling the upper frame, no eyes, no anatomy"
  hideOnly: string[]              // what the NEGATIVE may suppress: ["lit anatomy", "eyes", "teeth", "recognizable animal"]
  // NOTE: never suppress the element's PRESENCE; only its reveal. (A5/B4)
}

interface TextRef { id: string }          // → registry
interface TextRegistryEntry {
  id: string                              // "floor-counter-01"
  canonical: string                       // "FLOOR 01 / 66"  (single source of truth, A6)
  appearsIn: ShotCode[]
}
```

## Scene & resolved output

```ts
interface Scene {
  id: SceneId
  characters: CharacterElement[]
  shotsInOrder: Shot[]
  initialStates: Record<ElementId, PhysicalState>
}

interface ResolvedShotState { opening: PhysicalState; closing: PhysicalState }
type ResolvedStates = Record<ShotCode, Record<ElementId, ResolvedShotState>>
```

## Compiler output

```ts
interface NbPrompt {
  subject: string; action: string; worldPlate: string
  opticalRealism: string; cameraCapture: string; skinSurface?: string
  textRendering?: string
  negative: string
}
```

## Persistence note

For the MVP, SQLite tables: `elements`, `shots`, `scenes`, `text_registry`, with nested `PhysicalState`/`StateDelta`/`Framing` stored as JSON columns. The resolved-state timeline is computed, not stored (recompute on read/save). The existing platform already uses SQLite + chokidar, so the compiled `.md`/`.tsv` outputs slot into the current file-watching dashboard with no UI change required.
