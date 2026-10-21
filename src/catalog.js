// Starter catalogue used by `npm run seed`.
// Product names and copy are original placeholders; photos are from Unsplash
// (free for commercial use under the Unsplash License) and are downloaded
// into /public/images/catalog by `npm run images`. Replace them with your own
// product photography from the admin dashboard.

const categories = [
  // Bathroom
  { slug: 'basins', name: 'Basins', department: 'bathroom', image: '1595428774862-a79ab68dbabb', description: 'Countertop, pedestal and thin-edge basins in ceramic and stone.' },
  { slug: 'bathroom-taps', name: 'Bathroom Taps', department: 'bathroom', image: '1687951276836-06efbfda608b', description: 'Basin mixers, bath fillers and wall-mounted taps in every finish.' },
  { slug: 'showers', name: 'Showers', department: 'bathroom', image: '1771681587476-f2846a2c9102', description: 'Shower kits, rainfall heads, handsets and walk-in screens.' },
  { slug: 'baths', name: 'Baths', department: 'bathroom', image: '1620626011761-996317b8d101', description: 'Freestanding and double-ended baths for a spa-like retreat.' },
  { slug: 'toilets', name: 'Toilets', department: 'bathroom', image: '1589824783837-6169889fa20f', description: 'Close-coupled, wall-hung and comfort-height toilets.' },
  { slug: 'vanity-units', name: 'Vanity Units', department: 'bathroom', image: '1595514535415-dae8580c416c', description: 'Vanity units, washstands and tall storage in oak, walnut and colour.' },
  { slug: 'mirrors', name: 'Mirrors', department: 'bathroom', image: '1778731660069-c26ea0eb6567', description: 'Framed, pill and LED illuminated bathroom mirrors.' },
  { slug: 'towel-rails', name: 'Towel Rails', department: 'bathroom', image: '1634342114131-d3d823ffcac4', description: 'Towel rings, bars, grab rails and heated towel radiators.' },
  { slug: 'bathroom-accessories', name: 'Bathroom Accessories', department: 'bathroom', image: '1783149173371-d852d86563c4', description: 'Soap dispensers, bathroom sets and finishing touches.' },
  // Kitchen
  { slug: 'kitchen-taps', name: 'Kitchen Taps', department: 'kitchen', image: '1610276099118-c929abaaa80a', description: 'Swan-neck, pull-out and spring kitchen mixers.' },
  { slug: 'kitchen-sinks', name: 'Kitchen Sinks', department: 'kitchen', image: '1609210884848-2d530cfb2a07', description: 'Inset, undermount and utility sinks in brushed steel.' },
  { slug: 'kitchen-accessories', name: 'Kitchen Storage & Accessories', department: 'kitchen', image: '1777499455310-80354aa1021f', description: 'Utensil rails, crocks, canisters, shelving and cookware.' }
];

// [name, category, price £, was £ (or null), finish, stock, image id, flags, short description]
const products = [
  // Basins
  ['Orla Round Countertop Basin 420mm', 'basins', 89.95, 119.95, 'White Gloss', 34, '1595428774862-a79ab68dbabb', 'featured', 'A softly rounded vitreous china bowl that sits proud on any worktop.'],
  ['Kerr Rectangular Countertop Basin 480mm', 'basins', 79.95, null, 'White Gloss', 41, '1595514535316-b8c85bf9bbf9', '', 'Crisp, square lines with a generous wash area and a slim 12mm rim.'],
  ['Halden Double Basin Worktop 1000mm', 'basins', 249.0, null, 'White Gloss', 9, '1595515770358-b0047714ccb9', 'new', 'Twin integrated bowls for busy family bathrooms and en-suites.'],
  ['Tamsin Thin-Edge Basin 800mm', 'basins', 159.0, null, 'White Gloss', 17, '1595515423720-fdd6c0717b83', '', 'An ultra-slim profile basin designed to sit on a matching vanity.'],
  ['Calder Concrete Integrated Basin 600mm', 'basins', 329.0, null, 'Concrete Grey', 6, '1763485956023-49c4a03283fd', 'featured,new', 'Hand-cast concrete-effect basin with a sloped, slot-drain finish.'],
  ['Wren Pedestal Basin 550mm', 'basins', 69.95, 84.95, 'White Gloss', 58, '1552321554-5fefe8c9ef14', '', 'A timeless full-pedestal basin that hides pipework neatly.'],
  ['Selsey Vessel Basin 400mm', 'basins', 139.0, null, 'White Matt', 22, '1576698483491-8c43f0862543', '', 'A shallow vessel basin that pairs beautifully with marble and brass.'],
  // Bathroom taps
  ['Arden 3-Hole Basin Mixer', 'bathroom-taps', 149.0, null, 'Matt Black', 27, '1687951276836-06efbfda608b', 'featured', 'A deck-mounted three-hole mixer with knurled lever handles.'],
  ['Linden Mono Basin Mixer', 'bathroom-taps', 54.95, 69.95, 'Chrome', 120, '1542855368-ca6ea825bca2', '', 'A compact single-lever mixer with ceramic disc cartridge.'],
  ['Hartley Traditional Bath Filler', 'bathroom-taps', 119.0, null, 'Chrome', 18, '1623111771733-d3ab4d26ce41', '', 'Classic crosshead bath filler with porcelain hot and cold indices.'],
  ['Hartley Crosshead Wall Spout', 'bathroom-taps', 99.0, null, 'Chrome', 14, '1761353854551-361b1c804849', '', 'Wall-mounted traditional spout for period-style bathrooms.'],
  ['Belgrave Bath Shower Mixer', 'bathroom-taps', 289.0, null, 'Brushed Brass', 8, '1769356814886-abdadde25ea7', 'featured', 'Exposed bath shower mixer with handset and lever diverter.'],
  ['Noir Tall Basin Mixer', 'bathroom-taps', 89.95, null, 'Matt Black', 36, '1773177930149-48a2f5df9e07', 'new', 'A tall, minimalist mixer for countertop and vessel basins.'],
  ['Arc High-Rise Basin Mixer', 'bathroom-taps', 99.95, 124.95, 'Matt Black', 25, '1773177930292-463ca3c5b86a', '', 'A sweeping arched spout with a slim side lever.'],
  // Showers
  ['Aura Exposed Shower Kit', 'showers', 219.0, 259.0, 'Brushed Brass', 12, '1771681587476-f2846a2c9102', 'featured', 'Thermostatic exposed shower with handset, hose and wall bracket.'],
  ['Onyx Handheld Shower Set', 'showers', 64.95, null, 'Matt Black', 47, '1785486250396-458eb9e38aa8', '', 'Five-function handset with 1.5m anti-twist hose and holder.'],
  ['Rainfall 250mm Round Shower Head', 'showers', 74.95, null, 'Chrome', 39, '1576678433413-202829a1ab98', '', 'Low-pressure friendly rain head with easy-clean silicone nozzles.'],
  ['Metro Slide Rail Shower Kit', 'showers', 89.95, null, 'Chrome', 31, '1566446896748-6075a87760c1', '', 'Adjustable riser rail, three-mode handset and soap dish.'],
  ['Marlow Concealed Thermostatic Shower', 'showers', 349.0, null, 'Matt Black', 7, '1613849925362-38fb4c16ff36', 'new', 'Twin-outlet concealed valve with fixed head and handset.'],
  ['Flow 3-Function Shower Handset', 'showers', 34.95, null, 'Chrome', 85, '1627008952471-a0339ea450c7', '', 'Rain, massage and mist sprays in an ergonomic handset.'],
  ['Clearline Walk-In Shower Screen 1200mm', 'showers', 299.0, 379.0, 'Chrome', 10, '1771929662486-f793e08f0f16', '', '8mm toughened safety glass with easy-clean coating.'],
  // Baths
  ['Siena Freestanding Bath 1700mm', 'baths', 649.0, 799.0, 'White Gloss', 5, '1620626011761-996317b8d101', 'featured', 'A double-ended acrylic bath with slim edges and integrated waste.'],
  ['Terra Stone Resin Bath', 'baths', 1295.0, null, 'Blush Pink', 3, '1507652313519-d4e9174996dd', 'new', 'Cast stone resin bath in a warm matt blush – a true statement piece.'],
  ['Fluted Freestanding Bath 1600mm', 'baths', 899.0, null, 'White Matt', 4, '1782805134604-8fc2b02c67a4', 'featured,new', 'Fluted exterior detail with a deep, comfortable soaking depth.'],
  ['Oslo Double-Ended Bath 1800mm', 'baths', 579.0, null, 'White Gloss', 6, '1600566752355-35792bedcfea', '', 'Generous double-ended design with central waste position.'],
  // Toilets
  ['Corwen Close-Coupled Toilet', 'toilets', 169.0, 199.0, 'White Gloss', 26, '1589824783837-6169889fa20f', '', 'Complete with soft-close seat and dual-flush cistern.'],
  ['Nova Wall-Hung Rimless Toilet', 'toilets', 229.0, null, 'White Gloss', 19, '1563204719-44395a035bb6', 'featured', 'Rimless pan for easier cleaning, with slim soft-close seat.'],
  ['Nova Wall-Hung Toilet & Frame Pack', 'toilets', 399.0, null, 'White Gloss', 11, '1569597967185-cd6120712154', '', 'Pan, 1.12m concealed frame and flush plate in one pack.'],
  ['Ashby Comfort Height Toilet', 'toilets', 189.0, null, 'White Gloss', 15, '1587527901949-ab0341697c1e', '', 'Raised 470mm pan height for easier, more accessible use.'],
  // Vanity units
  ['Fjord Oak Double Vanity 1200mm', 'vanity-units', 549.0, null, 'Natural Oak', 8, '1595514535415-dae8580c416c', 'featured', 'Wall-hung double vanity with two soft-close drawers.'],
  ['Fjord Oak Tall Storage Cabinet', 'vanity-units', 299.0, null, 'Natural Oak', 13, '1595428774223-ef52624120d2', '', 'Open-shelf tall unit for towels and toiletries.'],
  ['Ivy Fluted Vanity 600mm', 'vanity-units', 459.0, 529.0, 'Forest Green', 9, '1644916930530-0e4e5afdd20d', 'featured', 'Fluted fronts in deep green with brushed brass handles.'],
  ['Harlow Twin Washstand', 'vanity-units', 879.0, null, 'Natural Oak', 4, '1771681278446-6f8eb0c7323f', 'new', 'A pair of solid oak washstands with stone tops.'],
  ['Shaker Double Vanity 1500mm', 'vanity-units', 999.0, null, 'Dove Grey', 3, '1774578342098-66adff9c1fe1', '', 'Classic shaker doors and drawers with quartz worktop.'],
  ['Brook Walnut Vanity 800mm', 'vanity-units', 629.0, null, 'Walnut', 7, '1763485956310-55f3c0e822d5', '', 'Warm walnut veneer with an integrated stone basin.'],
  // Mirrors
  ['Loft Black Framed Mirror 700 x 500mm', 'mirrors', 79.95, null, 'Matt Black', 44, '1608501200359-354b01a203fa', '', 'A slim powder-coated aluminium frame for a modern look.'],
  ['Lumen LED Illuminated Mirror 1200mm', 'mirrors', 249.0, 289.0, 'Silver', 16, '1778731660069-c26ea0eb6567', 'featured', 'Backlit LED with demister pad and touch sensor.'],
  ['Capsule Pill Mirror', 'mirrors', 119.0, null, 'Brushed Brass', 21, '1613849925352-96348d26bc51', '', 'An elongated pill-shaped mirror framed in brushed brass.'],
  ['Soho Rounded Mirror', 'mirrors', 99.95, null, 'Matt Black', 18, '1663659504863-43dd69a5fda2', 'new', 'Soft-cornered rectangular mirror with a matt black frame.'],
  // Towel rails
  ['Thames Towel Ring', 'towel-rails', 24.95, null, 'Chrome', 96, '1619470107732-778affad97c8', '', 'Solid brass towel ring with concealed fixings.'],
  ['Thames Towel Ring', 'towel-rails', 27.95, null, 'Black Chrome', 64, '1619470107151-a1f8df4893d3', '', 'Solid brass towel ring in a smoky black chrome finish.'],
  ['Mayfair Towel Bar 600mm', 'towel-rails', 49.95, null, 'Brushed Brass', 38, '1634342114131-d3d823ffcac4', 'featured', 'Elegant wall-mounted towel bar in a living brushed brass.'],
  ['Heated Towel Radiator 1200 x 500mm', 'towel-rails', 159.0, 189.0, 'Chrome', 20, '1596683705523-eb49540c3934', '', 'Straight ladder rail delivering 1,650 BTU of heat output.'],
  ['Safety Grab Rail 450mm', 'towel-rails', 29.95, null, 'Satin Steel', 52, '1523192356089-561fc8bc0088', '', 'Stainless steel grab rail rated to 150kg.'],
  // Bathroom accessories
  ['Ribbed Glass Soap Dispenser', 'bathroom-accessories', 22.95, null, 'Sage & Brass', 110, '1783149173371-d852d86563c4', 'featured,new', 'Fluted sage glass with a polished brass pump.'],
  ['Blush Glass Bathroom Set (3 pc)', 'bathroom-accessories', 39.95, 49.95, 'Blush Pink', 46, '1645567455251-334ed4702f9b', '', 'Dispenser, tumbler and storage jar in tinted glass.'],
  ['Matte Pump Bottle Duo', 'bathroom-accessories', 29.95, null, 'Matt Black', 73, '1772038786507-647371ac686b', '', 'Refillable soap and lotion bottles in soft-touch matt.'],
  ['Amber Glass Soap Dispenser', 'bathroom-accessories', 16.95, null, 'Amber', 130, '1725940889761-35d90aead72d', '', 'Apothecary-style amber glass with black pump.'],
  ['Stone & Bamboo Soap Dispenser', 'bathroom-accessories', 19.95, null, 'Stone Grey', 88, '1656411129424-c3a768b43bb2', '', 'Concrete-effect body with a natural bamboo collar.'],
  // Kitchen taps
  ['Hudson Swan Neck Kitchen Mixer', 'kitchen-taps', 89.95, null, 'Chrome', 48, '1629078692818-c5a0443f4ae3', 'featured', '360° swivel swan-neck spout with single lever control.'],
  ['Hudson Kitchen Mixer', 'kitchen-taps', 99.95, null, 'Brushed Steel', 33, '1597742439545-1d6eaf54a470', '', 'Brushed stainless steel for a fingerprint-resistant finish.'],
  ['Pro Spring Pull-Down Kitchen Tap', 'kitchen-taps', 179.0, 219.0, 'Brushed Steel', 15, '1610276099118-c929abaaa80a', 'featured', 'Professional-style spring spout with dual-function spray.'],
  ['Ember Pull-Out Kitchen Tap', 'kitchen-taps', 139.0, null, 'Matt Black', 29, '1775359924006-557dba8c862b', 'new', 'Pull-out spray head with magnetic docking.'],
  ['Ember Gooseneck Kitchen Tap', 'kitchen-taps', 159.0, null, 'Gunmetal', 12, '1772567732996-bc693c4a016c', '', 'A tall gooseneck mixer in a deep gunmetal finish.'],
  ['Classic Monobloc Kitchen Tap', 'kitchen-taps', 69.95, null, 'Chrome', 67, '1567767326925-e2047bf469d0', '', 'An everyday monobloc mixer with high-arc spout.'],
  ['Aurelia Kitchen Mixer', 'kitchen-taps', 169.0, null, 'Brushed Brass', 10, '1565538810643-b5bdb714032a', 'new', 'Brushed brass swan-neck mixer to warm up any kitchen.'],
  // Kitchen sinks
  ['Inset Single Bowl Sink 540mm', 'kitchen-sinks', 119.0, null, 'Brushed Steel', 24, '1609210884848-2d530cfb2a07', 'featured', 'Square-radius bowl in 1.2mm stainless steel with waste kit.'],
  ['Undermount Brushed Steel Sink 500mm', 'kitchen-sinks', 149.0, null, 'Brushed Steel', 18, '1661045327753-3f2a047d00a4', '', 'Seamless undermount bowl for solid-surface worktops.'],
  ['Utility Deep Bowl Sink', 'kitchen-sinks', 99.95, 119.95, 'Stainless Steel', 21, '1554190797-85a5ca43f7f6', '', 'Extra-deep bowl for utility rooms and laundry spaces.'],
  // Kitchen accessories
  ['Hanging Utensil Rail with Hooks', 'kitchen-accessories', 34.95, null, 'Copper', 57, '1777499455310-80354aa1021f', 'featured', 'Wall rail with six S-hooks for pans and utensils.'],
  ['Stoneware Utensil Crock', 'kitchen-accessories', 19.95, null, 'Cream', 75, '1520981825232-ece5fae45120', '', 'Hand-glazed stoneware crock for spoons and spatulas.'],
  ['Olivewood Utensil Set (5 pc)', 'kitchen-accessories', 27.95, null, 'Olivewood', 62, '1730597363352-0a8fe6eb5d12', '', 'Sustainably sourced olivewood spoons and spatulas.'],
  ['Floating Oak Kitchen Shelves (Pair)', 'kitchen-accessories', 59.95, 74.95, 'Natural Oak', 30, '1556910602-38f53e68e15d', 'featured', 'Solid oak shelves with matt black brackets.'],
  ['Speckled Ceramic Canister Set', 'kitchen-accessories', 32.95, null, 'Speckled White', 49, '1610701596007-11502861dcfa', 'new', 'A trio of nesting ceramic pots with cork bases.'],
  ['Cast Iron Casserole 24cm', 'kitchen-accessories', 79.95, null, 'Teal', 2, '1556910633-5099dc3971e8', '', 'Enamelled cast iron for slow cooking on any hob.'],
  ['Pantry Glass Storage Jars (Set of 4)', 'kitchen-accessories', 24.95, null, 'Clear', 0, '1514237487632-b60bc844a47d', '', 'Airtight glass jars for dry goods and pantry staples.']
];

// Lifestyle photography for the homepage
const lifestyle = {
  hero: '1603825491103-bd638b1873b0',
  bathroom: '1600566752355-35792bedcfea',
  kitchen: '1622372738946-62e02505feb3',
  inspire1: '1629079447777-1e605162dc8d',
  inspire2: '1507089947368-19c1da9775ae',
  inspire3: '1604709177225-055f99402ea3',
  about: '1771681278369-e2a5480b8c29'
};

function allImageIds() {
  const ids = new Set();
  categories.forEach(c => ids.add(c.image));
  products.forEach(p => ids.add(p[6]));
  Object.values(lifestyle).forEach(id => ids.add(id));
  return [...ids];
}

module.exports = { categories, products, lifestyle, allImageIds };
