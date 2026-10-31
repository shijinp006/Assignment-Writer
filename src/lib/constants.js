// All page geometry is in "page units": an A4 sheet at 96 dpi.
export const PAGE_W = 794
export const PAGE_H = 1123

export const FONTS = [
  'Kalam',
  'Patrick Hand',
  'Caveat',
  'Indie Flower',
  'Shadows Into Light',
  'Gochi Hand',
  'Architects Daughter',
  'Handlee',
  'Schoolbell',
  'Homemade Apple',
  'Nanum Pen Script',
  'Reenie Beanie',
  'Cedarville Cursive',
  'Dawning of a New Day',
  'Covered By Your Grace',
  'Just Another Hand',
]

export const INKS = [
  { name: 'Blue pen', value: '#1b2f8f' },
  { name: 'Blue-black', value: '#22305e' },
  { name: 'Black', value: '#1c1c1c' },
  { name: 'Red', value: '#b3261e' },
  { name: 'Green', value: '#1e6b3a' },
]

/** "Human touch" presets: neat (default), natural, fast. */
export function NEAT_HAND() {
  return { shapeVariation: 0.45, letterVariation: 0.4, inkTexture: 0.3, messiness: 0.3, lineDrift: 0.3, pressure: 0.3, slant: 2 }
}
export function NATURAL_HAND() {
  return { shapeVariation: 0.7, letterVariation: 0.6, inkTexture: 0.4, messiness: 0.45, lineDrift: 0.5, pressure: 0.4, slant: 3 }
}
export function FAST_HAND() {
  return { shapeVariation: 1.1, letterVariation: 1, inkTexture: 0.5, messiness: 0.8, lineDrift: 0.9, pressure: 0.6, slant: 5 }
}

export const DEFAULT_SETTINGS = {
  font: 'Kalam',
  fontSize: 21,
  color: '#1b2f8f',
  baseline: 5,
  letterSpacing: 0,
  wordSpacing: 2,
  ...NEAT_HAND(),
  penThickness: -0.35, // -1 thin … 0 normal … 1 bold
  seed: 1,
  firstTemplateId: 'sgvu-cover',
  restTemplateId: 'sgvu-ruled',
  pageOverrides: {},
  cover: {
    name: 'SHIJIN P',
    program: 'BCA',
    specialization: '',
    enrollment: '202580901037',
    subject: 'Environmental Studies',
    semester: '2nd',
  },
  version: 3,
}

export const DEFAULT_TEXT = `# ASSIGNMENT - 2

1- Describe a pond ecosystem as an ideal ecosystem.

Ans: A pond ecosystem is a small fresh water ecosystem where living organisms interact with non-living components such as water, sunlight, air and soil. It is called an ideal ecosystem because it is self sustaining and contains all the basic components needed for life.
      The pond ecosystem has two main components:
## 1- Abiotic components
      * Water
      * Sunlight
      * Air
      * Soil
These provide suitable conditions for the growth of living organisms.

## 2- Biotic components
      * Producers : Green plants and algae prepare food by photosynthesis.
      * Consumers : Fish, insects, frogs, snails and birds depend on plants or other animals for food.
===
2- What is a __Biome__? Describe Tropical Rain Forests and Grassland Biomes.

Ans: A biome is a large geographical area with a particular climate, vegetation and animal life.
`
