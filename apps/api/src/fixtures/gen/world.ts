import type { Channel, Location, MenuItem, StockLevel } from "@evolv/contracts/types";

export interface ShiftTemplate {
  id: string;
  role: string;
  start: string;
  end: string;
  /** Sales window (24h clock, inclusive start, exclusive end) used to size the shift. */
  window: [number, number];
  /** Sales dollars one person covers in this window. */
  dollarsPerHead: number;
  min: number;
  /** Fixed head count regardless of sales (e.g. manager). */
  fixed?: number;
  /** Extra head on Fri/Sat. */
  weekendExtra?: number;
}

export interface SeriesConfig {
  locationId: string;
  outletId?: string;
  label: string;
  /** Typical net sales on a neutral weekday. */
  base: number;
  avgCheck: number;
  partySize: number;
  itemsPerCover: number;
  /** 17 buckets, 07:00 .. 23:00, relative weights (need not sum to 1). */
  hourlyProfile: number[];
  channelMix: Record<Channel, number>;
  tipRate: number;
  menu: MenuItem[];
  deadItemIds: string[];
  shifts: ShiftTemplate[];
  /** Deviation from the standard weekday curve. */
  weekdayFactors?: number[];
  /** Hour index (into hourlyProfile) where the kitchen's ticket rush lands. Defaults to the profile's own peak hour. */
  kitchenRushHourIndex?: number;
}

export const STANDARD_WEEKDAY = [1.0, 0.8, 0.8, 0.95, 1.05, 1.35, 1.35]; // Sun..Sat
export const QSR_WEEKDAY = [0.9, 0.85, 0.85, 1.0, 1.05, 1.3, 1.25];
export const HOTEL_BAR_WEEKDAY = [0.85, 0.75, 0.8, 0.95, 1.15, 1.4, 1.45];
/** Brunch spots swing hard to the weekend — tourists and lazy mornings, not commuters. */
export const BREAKFAST_WEEKDAY = [1.35, 0.75, 0.75, 0.8, 0.85, 1.1, 1.45];

// Every profile below is 17 values, index 0 = 07:00 .. index 16 = 23:00.
// Restaurants that don't open for breakfast simply carry zero weight in the first four slots.
const FSR_DINNER = [0, 0, 0, 0, 0.03, 0.07, 0.07, 0.04, 0.03, 0.04, 0.08, 0.14, 0.17, 0.14, 0.1, 0.06, 0.03];
const QSR_LUNCH = [0, 0, 0, 0, 0.08, 0.17, 0.16, 0.09, 0.05, 0.05, 0.09, 0.11, 0.09, 0.06, 0.03, 0.015, 0.005];
const CANTINA = [0, 0, 0, 0, 0.03, 0.08, 0.08, 0.05, 0.03, 0.04, 0.09, 0.14, 0.16, 0.13, 0.09, 0.05, 0.03];
// The hotel dining room actually serves breakfast, so it gets a real morning rush, not a placeholder.
const HOTEL_RESTAURANT = [0.05, 0.12, 0.14, 0.07, 0.08, 0.11, 0.09, 0.03, 0.02, 0.05, 0.09, 0.13, 0.15, 0.12, 0.07, 0.03, 0.01];
const HOTEL_BAR = [0, 0, 0, 0, 0.01, 0.03, 0.04, 0.04, 0.05, 0.08, 0.1, 0.11, 0.12, 0.13, 0.13, 0.1, 0.06];
// Breakfast-in-room plus a late-night bump (the wings and cheese board on the room-service menu).
const ROOM_SERVICE = [0.07, 0.14, 0.11, 0.05, 0.04, 0.08, 0.07, 0.03, 0.02, 0.04, 0.09, 0.12, 0.14, 0.12, 0.1, 0.09, 0.06];
// A brunch café: one sharp rush 8:00–10:00, a smaller late-brunch tail, closed by early afternoon.
const BREAKFAST_CAFE = [0.1, 0.2, 0.22, 0.16, 0.11, 0.1, 0.07, 0.03, 0.01, 0, 0, 0, 0, 0, 0, 0, 0];

const M = (id: string, name: string, category: string, price: number): MenuItem => ({ id, name, category, price });

const FSR_SHIFTS: ShiftTemplate[] = [
  { id: "lunch-foh", role: "Server", start: "11:00", end: "14:00", window: [11, 14], dollarsPerHead: 520, min: 1 },
  { id: "lunch-boh", role: "Line cook", start: "10:00", end: "15:00", window: [11, 15], dollarsPerHead: 1000, min: 1 },
  { id: "dinner-foh", role: "Server", start: "16:00", end: "23:00", window: [16, 24], dollarsPerHead: 1300, min: 2 },
  { id: "dinner-boh", role: "Line cook", start: "15:00", end: "23:00", window: [16, 24], dollarsPerHead: 1650, min: 2 },
  { id: "mgr", role: "Manager", start: "10:00", end: "22:00", window: [11, 24], dollarsPerHead: 1, min: 1, fixed: 1 },
  { id: "dish", role: "Dishwasher", start: "13:00", end: "23:00", window: [11, 24], dollarsPerHead: 1, min: 1, fixed: 1, weekendExtra: 1 },
];

const QSR_SHIFTS: ShiftTemplate[] = [
  { id: "open-cashier", role: "Cashier", start: "11:00", end: "15:00", window: [11, 15], dollarsPerHead: 850, min: 1 },
  { id: "open-cook", role: "Cook", start: "10:30", end: "15:00", window: [11, 15], dollarsPerHead: 850, min: 1 },
  { id: "eve-cashier", role: "Cashier", start: "15:00", end: "21:00", window: [15, 22], dollarsPerHead: 950, min: 1 },
  { id: "eve-cook", role: "Cook", start: "15:00", end: "21:30", window: [15, 22], dollarsPerHead: 950, min: 1 },
  { id: "lead", role: "Shift lead", start: "10:30", end: "21:30", window: [11, 22], dollarsPerHead: 1, min: 1, fixed: 1 },
];

const HOTEL_RESTAURANT_SHIFTS: ShiftTemplate[] = [
  { id: "bfast-foh", role: "Server", start: "07:00", end: "11:00", window: [7, 11], dollarsPerHead: 850, min: 1 },
  { id: "lunch-foh", role: "Server", start: "11:00", end: "14:00", window: [11, 14], dollarsPerHead: 520, min: 1 },
  { id: "day-boh", role: "Line cook", start: "06:30", end: "15:00", window: [7, 15], dollarsPerHead: 1450, min: 1 },
  { id: "dinner-foh", role: "Server", start: "16:00", end: "23:00", window: [16, 24], dollarsPerHead: 1300, min: 2 },
  { id: "dinner-boh", role: "Line cook", start: "15:00", end: "23:00", window: [16, 24], dollarsPerHead: 1650, min: 2 },
  { id: "mgr", role: "Outlet manager", start: "09:00", end: "21:00", window: [11, 24], dollarsPerHead: 1, min: 1, fixed: 1 },
];

const HOTEL_BAR_SHIFTS: ShiftTemplate[] = [
  { id: "day-bar", role: "Bartender", start: "11:00", end: "17:00", window: [11, 17], dollarsPerHead: 900, min: 1 },
  { id: "night-bar", role: "Bartender", start: "17:00", end: "23:30", window: [17, 24], dollarsPerHead: 900, min: 1 },
  { id: "barback", role: "Barback", start: "18:00", end: "23:30", window: [17, 24], dollarsPerHead: 1, min: 0, fixed: 0, weekendExtra: 1 },
];

const ROOM_SERVICE_SHIFTS: ShiftTemplate[] = [
  { id: "day-rs", role: "Room service attendant", start: "07:00", end: "15:00", window: [7, 15], dollarsPerHead: 550, min: 1 },
  { id: "night-rs", role: "Room service attendant", start: "15:00", end: "23:00", window: [15, 24], dollarsPerHead: 600, min: 1 },
];

const BREAKFAST_SHIFTS: ShiftTemplate[] = [
  { id: "open-foh", role: "Server", start: "06:30", end: "11:00", window: [7, 11], dollarsPerHead: 850, min: 1 },
  { id: "open-boh", role: "Cook", start: "06:00", end: "11:00", window: [7, 11], dollarsPerHead: 1050, min: 1 },
  { id: "late-foh", role: "Server", start: "11:00", end: "14:30", window: [11, 15], dollarsPerHead: 850, min: 1 },
  { id: "late-boh", role: "Cook", start: "11:00", end: "14:30", window: [11, 15], dollarsPerHead: 1100, min: 1 },
  { id: "mgr", role: "Manager", start: "06:30", end: "14:30", window: [7, 15], dollarsPerHead: 1, min: 1, fixed: 1 },
];

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export const LOCATIONS: Location[] = [
  {
    id: "prairie-table",
    name: "Prairie Table",
    shortName: "Prairie",
    type: "full_service",
    pos: "toast",
    city: "Calgary, AB",
    currency: "CAD",
    targetLabourPct: 0.28,
    menuItemCount: 45,
    staffCount: 22,
    kitchenTicketCapacityPerHour: 18,
    wageBands: [
      { role: "Server", hourlyRate: 16.5 },
      { role: "Line cook", hourlyRate: 21 },
      { role: "Dishwasher", hourlyRate: 17 },
      { role: "Manager", hourlyRate: 28 },
    ],
    owner: { name: "Dana Whitcombe", phone: "+1 403 555 0142", email: "dana@prairietable.ca" },
  },
  {
    id: "bow-valley-burger",
    name: "Bow Valley Burger Co.",
    shortName: "Bow Valley",
    type: "quick_service",
    pos: "square",
    city: "Canmore, AB",
    currency: "CAD",
    targetLabourPct: 0.28,
    menuItemCount: 18,
    staffCount: 12,
    kitchenTicketCapacityPerHour: 45,
    wageBands: [
      { role: "Cashier", hourlyRate: 16 },
      { role: "Cook", hourlyRate: 18 },
      { role: "Shift lead", hourlyRate: 22 },
    ],
    owner: { name: "Marcus Tremblay", phone: "+1 403 555 0187", email: "marcus@bowvalleyburger.ca" },
  },
  {
    id: "northside-cantina",
    name: "Northside Cantina",
    shortName: "Northside",
    type: "full_service",
    pos: "lightspeed",
    city: "Edmonton, AB",
    currency: "CAD",
    targetLabourPct: 0.28,
    menuItemCount: 38,
    staffCount: 18,
    kitchenTicketCapacityPerHour: 16,
    wageBands: [
      { role: "Server", hourlyRate: 16.5 },
      { role: "Line cook", hourlyRate: 20 },
      { role: "Dishwasher", hourlyRate: 17 },
      { role: "Manager", hourlyRate: 27 },
    ],
    owner: { name: "Lucía Ortega", phone: "+1 780 555 0119", email: "lucia@northsidecantina.ca" },
  },
  {
    id: "kensington-hotel",
    name: "The Kensington Hotel",
    shortName: "Kensington",
    type: "hotel",
    pos: "toast",
    city: "Calgary, AB",
    currency: "CAD",
    targetLabourPct: 0.3,
    menuItemCount: 50,
    staffCount: 41,
    kitchenTicketCapacityPerHour: 26,
    wageBands: [
      { role: "Server", hourlyRate: 17 },
      { role: "Line cook", hourlyRate: 22 },
      { role: "Bartender", hourlyRate: 17.5 },
      { role: "Barback", hourlyRate: 16 },
      { role: "Room service attendant", hourlyRate: 17 },
      { role: "Outlet manager", hourlyRate: 30 },
    ],
    outlets: [
      { id: "grange", name: "The Grange", kind: "restaurant", kitchenTicketCapacityPerHour: 11 },
      { id: "larkspur", name: "Larkspur Bar", kind: "bar", kitchenTicketCapacityPerHour: 9 },
      { id: "room-service", name: "Room Service", kind: "room_service", kitchenTicketCapacityPerHour: 6 },
    ],
    owner: { name: "Priya Raman", phone: "+1 403 555 0163", email: "priya.raman@kensingtoncalgary.com" },
  },
  {
    id: "the-early-bird",
    name: "The Early Bird",
    shortName: "Early Bird",
    type: "full_service",
    pos: "clover",
    city: "Banff, AB",
    currency: "CAD",
    targetLabourPct: 0.3,
    menuItemCount: 22,
    staffCount: 11,
    kitchenTicketCapacityPerHour: 20,
    wageBands: [
      { role: "Server", hourlyRate: 16.5 },
      { role: "Cook", hourlyRate: 19 },
      { role: "Manager", hourlyRate: 26 },
    ],
    owner: { name: "Jess Okonkwo", phone: "+1 403 555 0176", email: "jess@earlybirdbanff.ca" },
  },
];

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------

const PRAIRIE_MENU: MenuItem[] = [
  M("pt-beet-tartare", "Beet Tartare", "Starters", 16),
  M("pt-bison-carpaccio", "Bison Carpaccio", "Starters", 19),
  M("pt-saskatoon-salad", "Saskatoon Berry Salad", "Starters", 15),
  M("pt-squash-soup", "Roasted Squash Soup", "Starters", 12),
  M("pt-bread", "Prairie Bread & Cultured Butter", "Starters", 8),
  M("pt-pierogi", "Cheddar & Potato Pierogi", "Starters", 14),
  M("pt-trout-rillette", "Smoked Trout Rillette", "Starters", 17),
  M("pt-broccolini", "Charred Broccolini", "Starters", 13),
  M("pt-elk-meatballs", "Elk Meatballs", "Starters", 16),
  M("pt-duck-mousse", "Duck Liver Mousse", "Starters", 18),
  M("pt-striploin", "Alberta Beef Striploin", "Mains", 46),
  M("pt-short-rib", "Braised Short Rib", "Mains", 38),
  M("pt-bison-ribeye", "Bison Ribeye", "Mains", 54),
  M("pt-roast-chicken", "Half Roast Chicken", "Mains", 29),
  M("pt-pickerel", "Pan-Seared Pickerel", "Mains", 34),
  M("pt-lamb-shank", "Braised Lamb Shank", "Mains", 36),
  M("pt-risotto", "Wild Mushroom Risotto", "Mains", 27),
  M("pt-pork-chop", "Bone-in Pork Chop", "Mains", 33),
  M("pt-steelhead", "Steelhead Trout", "Mains", 32),
  M("pt-tagliatelle", "Mushroom Tagliatelle", "Mains", 26),
  M("pt-wellington", "Vegetable Wellington", "Mains", 28),
  M("pt-burger", "Prairie Burger", "Mains", 24),
  M("pt-cassoulet", "Lentil Cassoulet", "Mains", 25),
  M("pt-schnitzel", "Chicken Schnitzel", "Mains", 28),
  M("pt-duck-fat-fries", "Duck-Fat Fries", "Sides", 9),
  M("pt-garlic-mash", "Garlic Mash", "Sides", 8),
  M("pt-veg", "Seasonal Vegetables", "Sides", 8),
  M("pt-mac", "Baked Mac & Cheese", "Sides", 11),
  M("pt-corn", "Grilled Corn", "Sides", 7),
  M("pt-saskatoon-pie", "Saskatoon Pie", "Desserts", 11),
  M("pt-sticky-toffee", "Sticky Toffee Pudding", "Desserts", 12),
  M("pt-torte", "Chocolate Torte", "Desserts", 12),
  M("pt-cheesecake", "Baked Cheesecake", "Desserts", 11),
  M("pt-ice-cream", "Ice Cream Trio", "Desserts", 9),
  M("pt-house-red", "House Red (6 oz)", "Drinks", 13),
  M("pt-house-white", "House White (6 oz)", "Drinks", 12),
  M("pt-lager", "Wild Rose Lager", "Drinks", 8),
  M("pt-ipa", "Craft IPA", "Drinks", 9),
  M("pt-old-fashioned", "Old Fashioned", "Drinks", 15),
  M("pt-prairie-sour", "Prairie Sour", "Drinks", 14),
  M("pt-negroni", "Negroni", "Drinks", 15),
  M("pt-espresso", "Espresso", "Drinks", 4),
  M("pt-sparkling", "Sparkling Water", "Drinks", 5),
  M("pt-kombucha", "Kombucha", "Drinks", 6),
  M("pt-caesar", "Classic Caesar", "Drinks", 12),
];

const BVB_MENU: MenuItem[] = [
  M("bv-classic", "Classic Burger", "Burgers", 11.5),
  M("bv-cheese", "Cheeseburger", "Burgers", 12.5),
  M("bv-bacon", "Bacon Cheeseburger", "Burgers", 14.5),
  M("bv-double", "Double Stack", "Burgers", 16),
  M("bv-mushroom", "Mushroom Swiss", "Burgers", 14),
  M("bv-chicken", "Crispy Chicken Sandwich", "Burgers", 13),
  M("bv-spicy-chicken", "Spicy Chicken Sandwich", "Burgers", 13.5),
  M("bv-veggie", "Veggie Burger", "Burgers", 12.5),
  M("bv-kids", "Kids Burger", "Burgers", 8),
  M("bv-fries", "Fries", "Sides", 5),
  M("bv-poutine", "Poutine", "Sides", 9),
  M("bv-rings", "Onion Rings", "Sides", 6),
  M("bv-shake", "Milkshake", "Drinks", 7),
  M("bv-fountain", "Fountain Drink", "Drinks", 3),
  M("bv-water", "Bottled Water", "Drinks", 2.5),
  M("bv-salad", "Garden Salad", "Sides", 9),
  M("bv-chili", "Chili Cup", "Sides", 7),
  M("bv-grilled-cheese", "Grilled Cheese", "Burgers", 8),
];

const CANTINA_MENU: MenuItem[] = [
  M("nc-pastor", "Tacos al Pastor", "Tacos", 15),
  M("nc-carnitas", "Carnitas Tacos", "Tacos", 15),
  M("nc-baja", "Baja Fish Tacos", "Tacos", 17),
  M("nc-birria", "Birria Tacos", "Tacos", 18),
  M("nc-veg-tacos", "Roasted Veg Tacos", "Tacos", 14),
  M("nc-tinga", "Chicken Tinga Tacos", "Tacos", 15),
  M("nc-burrito-chicken", "Chicken Burrito", "Mains", 16),
  M("nc-burrito-steak", "Steak Burrito", "Mains", 18),
  M("nc-bowl", "Burrito Bowl", "Mains", 16),
  M("nc-quesadilla", "Quesadilla", "Mains", 14),
  M("nc-enchiladas", "Enchiladas Verdes", "Mains", 19),
  M("nc-relleno", "Chile Relleno", "Mains", 18),
  M("nc-nachos", "Nachos Grande", "Starters", 16),
  M("nc-guac", "Guacamole & Chips", "Starters", 12),
  M("nc-fundido", "Queso Fundido", "Starters", 13),
  M("nc-elote", "Elote", "Starters", 7),
  M("nc-ceviche", "Ceviche", "Starters", 16),
  M("nc-tortilla-soup", "Tortilla Soup", "Starters", 10),
  M("nc-pozole", "Pozole Rojo", "Mains", 17),
  M("nc-tamales", "Tamales (2)", "Mains", 13),
  M("nc-churros", "Churros", "Desserts", 8),
  M("nc-tres-leches", "Tres Leches", "Desserts", 9),
  M("nc-flan", "Flan", "Desserts", 8),
  M("nc-horchata", "Horchata", "Drinks", 5),
  M("nc-jarritos", "Jarritos", "Drinks", 4),
  M("nc-mex-coke", "Mexican Coke", "Drinks", 4),
  M("nc-margarita", "Classic Margarita", "Drinks", 13),
  M("nc-spicy-marg", "Spicy Margarita", "Drinks", 14),
  M("nc-paloma", "Paloma", "Drinks", 12),
  M("nc-lager", "Mexican Lager", "Drinks", 7),
  M("nc-michelada", "Michelada", "Drinks", 9),
  M("nc-mezcal-negroni", "Mezcal Negroni", "Drinks", 15),
  M("nc-kids-quesadilla", "Kids Quesadilla", "Mains", 8),
  M("nc-rice-beans", "Rice & Beans", "Sides", 5),
  M("nc-chips-salsa", "Chips & Salsa", "Sides", 6),
  M("nc-family-kit", "Family Taco Kit", "Mains", 58),
  M("nc-sopes", "Sopes (3)", "Starters", 13),
  M("nc-aguachile", "Aguachile", "Starters", 17),
];

const GRANGE_MENU: MenuItem[] = [
  M("kh-g-benedict", "Eggs Benedict", "Breakfast", 21),
  M("kh-g-avo-toast", "Avocado Toast", "Breakfast", 17),
  M("kh-g-full-bfast", "Full Breakfast", "Breakfast", 24),
  M("kh-g-pancakes", "Buttermilk Pancakes", "Breakfast", 16),
  M("kh-g-granola", "Granola & Yogurt", "Breakfast", 13),
  M("kh-g-salmon-bagel", "Smoked Salmon Bagel", "Breakfast", 19),
  M("kh-g-club", "Club Sandwich", "Lunch", 22),
  M("kh-g-caesar", "Caesar Salad", "Lunch", 18),
  M("kh-g-beet-salad", "Beet & Goat Cheese Salad", "Lunch", 17),
  M("kh-g-tomato-soup", "Tomato Soup", "Lunch", 12),
  M("kh-g-steak-frites", "Steak Frites", "Dinner", 44),
  M("kh-g-chicken", "Roast Chicken Supreme", "Dinner", 32),
  M("kh-g-halibut", "Seared Halibut", "Dinner", 41),
  M("kh-g-risotto", "Mushroom Risotto", "Dinner", 28),
  M("kh-g-lamb", "Lamb Rack", "Dinner", 48),
  M("kh-g-duck", "Duck Breast", "Dinner", 42),
  M("kh-g-truffle-fries", "Truffle Fries", "Sides", 11),
  M("kh-g-brulee", "Crème Brûlée", "Desserts", 12),
  M("kh-g-lemon-tart", "Lemon Tart", "Desserts", 12),
  M("kh-g-cheese", "Cheese Board", "Desserts", 24),
  M("kh-g-coffee", "Coffee", "Drinks", 4.5),
  M("kh-g-juice", "Fresh Juice", "Drinks", 7),
  M("kh-g-wine", "Wine (6 oz)", "Drinks", 15),
  M("kh-g-water", "Bottled Water", "Drinks", 6),
];

const LARKSPUR_MENU: MenuItem[] = [
  M("kh-b-old-fashioned", "Larkspur Old Fashioned", "Cocktails", 17),
  M("kh-b-espresso-martini", "Espresso Martini", "Cocktails", 17),
  M("kh-b-negroni", "Negroni", "Cocktails", 16),
  M("kh-b-gt", "Gin & Tonic", "Cocktails", 14),
  M("kh-b-lager", "Local Lager", "Beer & Wine", 9),
  M("kh-b-ipa", "Craft IPA", "Beer & Wine", 10),
  M("kh-b-wine", "Wine (6 oz)", "Beer & Wine", 15),
  M("kh-b-whisky-flight", "Whisky Flight", "Cocktails", 32),
  M("kh-b-nuts", "Bar Nuts", "Snacks", 6),
  M("kh-b-truffle-fries", "Truffle Fries", "Snacks", 11),
  M("kh-b-sliders", "Beef Sliders (3)", "Snacks", 19),
  M("kh-b-charcuterie", "Charcuterie Board", "Snacks", 28),
  M("kh-b-oysters", "Oysters (half dozen)", "Snacks", 24),
  M("kh-b-mocktail", "Seasonal Mocktail", "Cocktails", 9),
];

const ROOM_SERVICE_MENU: MenuItem[] = [
  M("kh-r-club", "Club Sandwich", "All day", 26),
  M("kh-r-pizza", "Margherita Pizza", "All day", 24),
  M("kh-r-caesar", "Caesar Salad", "All day", 20),
  M("kh-r-burger", "Burger & Fries", "All day", 27),
  M("kh-r-continental", "Continental Breakfast", "Breakfast", 22),
  M("kh-r-soup", "Chicken Noodle Soup", "All day", 14),
  M("kh-r-fruit", "Fruit Plate", "Breakfast", 15),
  M("kh-r-cheese", "Cheese Board", "Late night", 28),
  M("kh-r-wings", "Late Night Wings", "Late night", 19),
  M("kh-r-wine", "Bottle of Wine", "Drinks", 58),
  M("kh-r-water", "Sparkling Water", "Drinks", 7),
  M("kh-r-kids-pasta", "Kids Pasta", "All day", 12),
];

const EARLY_BIRD_MENU: MenuItem[] = [
  M("eb-pancakes", "Buttermilk Pancakes", "Breakfast", 14),
  M("eb-benny", "Classic Eggs Benedict", "Breakfast", 17),
  M("eb-benny-salmon", "Smoked Salmon Benedict", "Breakfast", 19),
  M("eb-avo-toast", "Avocado Toast", "Breakfast", 15),
  M("eb-burrito", "Breakfast Burrito", "Breakfast", 16),
  M("eb-french-toast", "Brioche French Toast", "Breakfast", 15),
  M("eb-quiche", "Quiche of the Day", "Breakfast", 13),
  M("eb-granola", "Granola & Yogurt Bowl", "Breakfast", 11),
  M("eb-oatmeal", "Steel-Cut Oatmeal", "Breakfast", 9),
  M("eb-egg-sandwich", "Egg & Cheese Sandwich", "Breakfast", 10),
  M("eb-omelette", "Farmhouse Omelette", "Breakfast", 15),
  M("eb-huevos", "Huevos Rancheros", "Brunch", 16),
  M("eb-waffle", "Belgian Waffle", "Breakfast", 14),
  M("eb-hash", "Home Fries", "Sides", 6),
  M("eb-bacon", "Side Bacon", "Sides", 5),
  M("eb-sausage", "Side Sausage", "Sides", 5),
  M("eb-coffee", "Drip Coffee", "Drinks", 4),
  M("eb-latte", "Latte", "Drinks", 5.5),
  M("eb-juice", "Fresh Orange Juice", "Drinks", 6),
  M("eb-smoothie", "Mixed Berry Smoothie", "Drinks", 7),
  M("eb-mimosa", "Mimosa", "Drinks", 9),
  M("eb-caesar", "Classic Caesar", "Drinks", 11),
];

export const SERIES: SeriesConfig[] = [
  {
    locationId: "prairie-table",
    label: "Prairie Table",
    base: 6000,
    avgCheck: 48,
    partySize: 2.4,
    itemsPerCover: 2.6,
    hourlyProfile: FSR_DINNER,
    channelMix: { dine_in: 0.78, takeout: 0.14, delivery: 0.08, room_service: 0 },
    tipRate: 0.16,
    menu: PRAIRIE_MENU,
    deadItemIds: ["pt-beet-tartare", "pt-duck-mousse", "pt-cassoulet"],
    shifts: FSR_SHIFTS,
  },
  {
    locationId: "bow-valley-burger",
    label: "Bow Valley Burger Co.",
    base: 3500,
    avgCheck: 15.5,
    partySize: 1.3,
    itemsPerCover: 1.9,
    hourlyProfile: QSR_LUNCH,
    channelMix: { dine_in: 0.45, takeout: 0.35, delivery: 0.2, room_service: 0 },
    tipRate: 0.07,
    menu: BVB_MENU,
    deadItemIds: ["bv-salad", "bv-chili", "bv-grilled-cheese"],
    shifts: QSR_SHIFTS,
    weekdayFactors: QSR_WEEKDAY,
  },
  {
    locationId: "northside-cantina",
    label: "Northside Cantina",
    base: 5000,
    avgCheck: 34,
    partySize: 2.3,
    itemsPerCover: 2.4,
    hourlyProfile: CANTINA,
    channelMix: { dine_in: 0.52, takeout: 0.18, delivery: 0.3, room_service: 0 },
    tipRate: 0.14,
    menu: CANTINA_MENU,
    deadItemIds: ["nc-relleno", "nc-pozole", "nc-flan"],
    shifts: FSR_SHIFTS,
  },
  {
    locationId: "kensington-hotel",
    outletId: "grange",
    label: "The Grange",
    base: 5200,
    avgCheck: 39,
    partySize: 2.1,
    itemsPerCover: 2.3,
    hourlyProfile: HOTEL_RESTAURANT,
    channelMix: { dine_in: 0.94, takeout: 0.06, delivery: 0, room_service: 0 },
    tipRate: 0.15,
    menu: GRANGE_MENU,
    deadItemIds: ["kh-g-duck"],
    shifts: HOTEL_RESTAURANT_SHIFTS,
    weekdayFactors: [1.1, 0.85, 0.85, 0.95, 1.0, 1.25, 1.3],
    // The whole hotel converges on the 19:00 hour: dinner in the Grange, the bar filling up, room service's evening rush.
    kitchenRushHourIndex: 12,
  },
  {
    locationId: "kensington-hotel",
    outletId: "larkspur",
    label: "Larkspur Bar",
    base: 2600,
    avgCheck: 27,
    partySize: 1.9,
    itemsPerCover: 2.1,
    hourlyProfile: HOTEL_BAR,
    channelMix: { dine_in: 1, takeout: 0, delivery: 0, room_service: 0 },
    tipRate: 0.17,
    menu: LARKSPUR_MENU,
    deadItemIds: ["kh-b-whisky-flight"],
    shifts: HOTEL_BAR_SHIFTS,
    weekdayFactors: HOTEL_BAR_WEEKDAY,
    kitchenRushHourIndex: 12,
  },
  {
    locationId: "kensington-hotel",
    outletId: "room-service",
    label: "Room Service",
    base: 1700,
    avgCheck: 41,
    partySize: 1.4,
    itemsPerCover: 1.8,
    hourlyProfile: ROOM_SERVICE,
    channelMix: { dine_in: 0, takeout: 0, delivery: 0, room_service: 1 },
    tipRate: 0.12,
    menu: ROOM_SERVICE_MENU,
    deadItemIds: ["kh-r-kids-pasta"],
    shifts: ROOM_SERVICE_SHIFTS,
    weekdayFactors: [1.05, 0.9, 0.9, 0.95, 1.0, 1.15, 1.2],
    kitchenRushHourIndex: 12,
  },
  {
    locationId: "the-early-bird",
    label: "The Early Bird",
    base: 1900,
    avgCheck: 19,
    partySize: 2.2,
    itemsPerCover: 1.9,
    hourlyProfile: BREAKFAST_CAFE,
    channelMix: { dine_in: 0.82, takeout: 0.16, delivery: 0.02, room_service: 0 },
    tipRate: 0.13,
    menu: EARLY_BIRD_MENU,
    deadItemIds: ["eb-huevos", "eb-oatmeal", "eb-quiche"],
    shifts: BREAKFAST_SHIFTS,
    weekdayFactors: BREAKFAST_WEEKDAY,
  },
];

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

type StockSeed = [name: string, category: string, unit: string, par: number, dailyUsage: number, unitCost: number, supplier: string, onHandRatio?: number];

const S = (rows: StockSeed[], locationId: string, prefix: string): Array<Omit<StockLevel, "countedAt"> & { plantedRatio?: number }> =>
  rows.map((r, i) => ({
    locationId,
    itemId: `${prefix}-stk-${(i + 1).toString().padStart(2, "0")}`,
    name: r[0],
    category: r[1],
    unit: r[2],
    par: r[3],
    dailyUsage: r[4],
    unitCost: r[5],
    supplier: r[6],
    onHand: 0,
    plantedRatio: r[7],
  }));

export const STOCK = {
  "prairie-table": S(
    [
      ["Chicken thigh", "Protein", "lb", 40, 9, 5.3, "Sysco", 0.2],
      ["Alberta beef striploin", "Protein", "lb", 30, 6, 18.5, "Sysco"],
      ["Bison ribeye", "Protein", "lb", 16, 3, 24, "Noble Premium Bison"],
      ["Beef short rib", "Protein", "lb", 35, 7, 9.8, "Sysco"],
      ["Pickerel fillet", "Protein", "lb", 18, 4, 16, "GFS"],
      ["Steelhead trout", "Protein", "lb", 15, 3, 14.5, "GFS"],
      ["Lamb shank", "Protein", "ea", 24, 5, 11, "Sysco"],
      ["Pork chop", "Protein", "ea", 30, 6, 6.4, "Sysco"],
      ["Ground elk", "Protein", "lb", 12, 2, 15, "Noble Premium Bison"],
      ["Duck fat", "Pantry", "kg", 6, 1, 19, "GFS"],
      ["Russet potatoes", "Produce", "case", 4, 0.8, 32, "GFS", 0.5],
      ["Yukon gold potatoes", "Produce", "lb", 60, 12, 1.1, "Poplar Bluff Organics"],
      ["Beets", "Produce", "lb", 20, 3, 1.8, "Poplar Bluff Organics"],
      ["Butternut squash", "Produce", "lb", 25, 5, 1.4, "Poplar Bluff Organics"],
      ["Cremini mushrooms", "Produce", "lb", 20, 5, 6.5, "GFS", 0.55],
      ["Broccolini", "Produce", "case", 5, 1.2, 38, "GFS"],
      ["Saskatoon berries (frozen)", "Produce", "kg", 10, 1.5, 22, "Solstice Berry Farm"],
      ["Heavy cream", "Dairy", "L", 24, 6, 4.2, "GFS", 0.45],
      ["Cultured butter", "Dairy", "kg", 10, 2, 13, "Vital Green Farms"],
      ["Arborio rice", "Pantry", "kg", 15, 2.5, 4.8, "GFS"],
      ["House red wine", "Bar", "btl", 48, 10, 11, "Vintage West"],
      ["House white wine", "Bar", "btl", 40, 8, 10.5, "Vintage West"],
      ["Wild Rose lager", "Bar", "keg", 3, 0.6, 185, "Wild Rose Brewery"],
      ["Espresso beans", "Pantry", "kg", 8, 1.2, 34, "Phil & Sebastian"],
      ["Sparkling water", "Bar", "case", 12, 2.5, 22, "GFS"],
    ],
    "prairie-table",
    "pt",
  ),
  "bow-valley-burger": S(
    [
      ["Beef patties (4 oz)", "Protein", "ea", 600, 140, 0.95, "Sysco", 0.35],
      ["Brioche buns", "Bakery", "ea", 500, 120, 0.42, "Wild Flour Bakery", 0.18],
      ["Bacon", "Protein", "lb", 30, 6, 6.8, "Sysco"],
      ["American cheese slices", "Dairy", "ea", 800, 150, 0.18, "GFS"],
      ["Swiss cheese", "Dairy", "lb", 12, 2, 7.2, "GFS"],
      ["Chicken breast", "Protein", "lb", 60, 14, 5.1, "Sysco"],
      ["Veggie patties", "Protein", "ea", 60, 8, 1.6, "GFS"],
      ["Fries (frozen)", "Frozen", "case", 12, 3, 28, "GFS"],
      ["Cheese curds", "Dairy", "kg", 10, 2.2, 14, "Sylvan Star Cheese"],
      ["Gravy mix", "Pantry", "kg", 6, 1, 9, "GFS"],
      ["Onion rings (frozen)", "Frozen", "case", 6, 1.2, 31, "GFS"],
      ["Lettuce", "Produce", "case", 4, 1, 26, "GFS"],
      ["Tomatoes", "Produce", "lb", 30, 7, 2.1, "GFS"],
      ["Red onions", "Produce", "lb", 25, 4, 1.2, "GFS"],
      ["Pickles", "Pantry", "jar", 6, 1, 12, "GFS"],
      ["Ketchup", "Pantry", "jug", 8, 1.5, 11, "GFS"],
      ["Burger sauce", "Pantry", "L", 12, 3, 6, "In-house"],
      ["Mushrooms", "Produce", "lb", 15, 3, 5.9, "GFS"],
      ["Ice cream mix", "Dairy", "L", 30, 6, 4.4, "GFS"],
      ["Fountain syrup", "Drinks", "BIB", 10, 1.5, 68, "Coca-Cola Canada"],
      ["Bottled water", "Drinks", "case", 15, 3, 9, "GFS"],
      ["Cups (16 oz)", "Packaging", "sleeve", 40, 8, 6.5, "Packaging Plus"],
      ["Takeout boxes", "Packaging", "case", 8, 1.5, 45, "Packaging Plus", 0.4],
      ["Fryer oil", "Pantry", "jug", 12, 2.5, 38, "GFS", 0.42],
      ["Cookie dough", "Frozen", "case", 4, 0.7, 42, "GFS"],
    ],
    "bow-valley-burger",
    "bv",
  ),
  "northside-cantina": S(
    [
      ["Pork shoulder", "Protein", "lb", 50, 11, 3.9, "Sysco"],
      ["Beef chuck (birria)", "Protein", "lb", 40, 9, 7.6, "Sysco", 0.38],
      ["Chicken thigh", "Protein", "lb", 45, 10, 5.3, "Sysco"],
      ["Cod fillet", "Protein", "lb", 20, 4, 11, "GFS"],
      ['Corn tortillas (6")', "Bakery", "ea", 3000, 700, 0.09, "La Tortilleria"],
      ['Flour tortillas (12")', "Bakery", "ea", 600, 130, 0.28, "La Tortilleria", 0.2],
      ["Avocados", "Produce", "case", 10, 2.5, 62, "GFS", 0.4],
      ["Limes", "Produce", "case", 6, 1.2, 45, "GFS"],
      ["Cilantro", "Produce", "bunch", 40, 9, 1.1, "GFS"],
      ["White onions", "Produce", "lb", 40, 8, 1, "GFS"],
      ["Tomatillos", "Produce", "lb", 20, 4, 2.8, "GFS"],
      ["Dried guajillo chiles", "Pantry", "kg", 5, 0.6, 21, "Mercado Imports"],
      ["Oaxaca cheese", "Dairy", "kg", 12, 2.5, 16, "GFS", 0.42],
      ["Cotija cheese", "Dairy", "kg", 6, 1, 19, "Mercado Imports"],
      ["Black beans (dry)", "Pantry", "kg", 30, 5, 3.2, "GFS"],
      ["Rice", "Pantry", "kg", 40, 7, 2.4, "GFS"],
      ["Masa harina", "Pantry", "kg", 20, 3, 3.6, "Mercado Imports"],
      ["Sour cream", "Dairy", "L", 15, 3, 5, "GFS"],
      ["Tequila blanco", "Bar", "btl", 18, 3.5, 32, "Alberta Liquor"],
      ["Mezcal", "Bar", "btl", 8, 1, 48, "Alberta Liquor"],
      ["Mexican lager", "Bar", "case", 20, 4, 42, "Alberta Liquor"],
      ["Jarritos", "Drinks", "case", 10, 2, 24, "Mercado Imports"],
      ["Fryer oil", "Pantry", "jug", 10, 2, 38, "GFS"],
      ["Takeout containers", "Packaging", "case", 12, 3, 44, "Packaging Plus"],
      ["Delivery bags", "Packaging", "case", 6, 1.5, 36, "Packaging Plus"],
    ],
    "northside-cantina",
    "nc",
  ),
  "kensington-hotel": S(
    [
      ["Eggs", "Dairy", "flat", 40, 9, 7.5, "Sysco"],
      ["Bacon", "Protein", "lb", 40, 8, 6.8, "Sysco"],
      ["Smoked salmon", "Protein", "kg", 8, 1.5, 42, "GFS"],
      ["Beef striploin", "Protein", "lb", 30, 6, 18.5, "Sysco"],
      ["Chicken supreme", "Protein", "ea", 60, 12, 4.2, "Sysco", 0.37],
      ["Halibut", "Protein", "lb", 15, 3, 24, "GFS"],
      ["Lamb rack", "Protein", "ea", 20, 3, 21, "Sysco"],
      ["Duck breast", "Protein", "ea", 12, 1, 13, "GFS"],
      ["Slider patties", "Protein", "ea", 200, 40, 0.9, "Sysco"],
      ["Chicken wings", "Protein", "lb", 40, 8, 4.6, "Sysco"],
      ["Oysters", "Protein", "dz", 12, 2.5, 22, "Codfathers"],
      ["Pizza dough", "Bakery", "ea", 60, 12, 1.1, "In-house"],
      ["Mozzarella", "Dairy", "kg", 10, 2, 12.5, "GFS"],
      ["Mixed greens", "Produce", "case", 6, 1.5, 28, "GFS", 0.33],
      ["Avocados", "Produce", "case", 6, 1.2, 62, "GFS"],
      ["Fresh fruit (assorted)", "Produce", "case", 8, 2, 55, "GFS"],
      ["Heavy cream", "Dairy", "L", 30, 6, 4.2, "GFS"],
      ["Espresso beans", "Pantry", "kg", 12, 2.5, 34, "Phil & Sebastian"],
      ["Orange juice", "Drinks", "L", 40, 9, 3.8, "GFS", 0.2],
      ["Gin", "Bar", "btl", 12, 2, 30, "Alberta Liquor"],
      ["Bourbon", "Bar", "btl", 12, 2, 38, "Alberta Liquor"],
      ["Vodka", "Bar", "btl", 10, 2, 26, "Alberta Liquor"],
      ["Red wine (by the glass)", "Bar", "btl", 48, 9, 14, "Vintage West", 0.42],
      ["Sparkling wine", "Bar", "btl", 24, 3, 19, "Vintage West"],
      ["Bar nuts", "Pantry", "kg", 6, 1, 15, "GFS"],
    ],
    "kensington-hotel",
    "kh",
  ),
  "the-early-bird": S(
    [
      ["Eggs", "Dairy", "flat", 50, 12, 7.5, "Sysco", 0.22],
      ["Bacon", "Protein", "lb", 25, 6, 6.8, "Sysco", 0.55],
      ["Breakfast sausage", "Protein", "lb", 20, 4, 6.2, "Sysco"],
      ["Sourdough bread", "Bakery", "loaf", 20, 5, 4.5, "Wild Flour Bakery", 0.5],
      ["Brioche bread", "Bakery", "loaf", 10, 2, 5.2, "Wild Flour Bakery"],
      ["Butter", "Dairy", "kg", 8, 1.5, 9.5, "Vital Green Farms"],
      ["Maple syrup", "Pantry", "L", 6, 1, 14, "Poplar Bluff Organics"],
      ["Pancake mix", "Pantry", "kg", 15, 3, 3.8, "GFS"],
      ["Smoked salmon", "Protein", "kg", 4, 0.8, 42, "GFS"],
      ["Avocados", "Produce", "case", 5, 1.2, 62, "GFS"],
      ["Russet potatoes", "Produce", "lb", 40, 9, 1.1, "GFS"],
      ["Cheddar cheese", "Dairy", "kg", 6, 1.2, 11, "Sylvan Star Cheese"],
      ["Cream cheese", "Dairy", "kg", 5, 1, 8, "GFS"],
      ["Milk", "Dairy", "L", 30, 7, 2.1, "GFS"],
      ["Heavy cream", "Dairy", "L", 10, 2, 4.2, "GFS"],
      ["Orange juice", "Drinks", "L", 20, 5, 3.8, "GFS", 0.55],
      ["Espresso beans", "Pantry", "kg", 8, 1.8, 34, "Phil & Sebastian"],
      ["Granola", "Pantry", "kg", 6, 1, 9, "In-house"],
      ["Greek yogurt", "Dairy", "kg", 8, 1.6, 6.5, "GFS"],
      ["Mixed berries (frozen)", "Produce", "kg", 8, 1.5, 12, "Solstice Berry Farm"],
      ["Sparkling wine", "Bar", "btl", 15, 3, 12, "Vintage West"],
      ["Hot sauce", "Pantry", "btl", 10, 1, 6, "GFS"],
      ["Ketchup", "Pantry", "jug", 6, 1, 11, "GFS"],
      ["To-go cups", "Packaging", "sleeve", 20, 4, 6.5, "Packaging Plus"],
      ["Takeout containers", "Packaging", "case", 8, 1.5, 30, "Packaging Plus"],
    ],
    "the-early-bird",
    "eb",
  ),
} as const;
