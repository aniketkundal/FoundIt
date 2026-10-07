// Canonical domain lists — the single source of truth, served to the client
// via GET /api/config so there's no duplicated list to keep in sync.
// Edit freely: these are config, not logic.

export const ITEM_TYPES = ['lost', 'found'];

export const CATEGORIES = [
  'Electronics',
  'Phone',
  'Laptop',
  'Charger/Cable',
  'Wallet/Purse',
  'ID/Cards',
  'Keys',
  'Bag/Backpack',
  'Books/Stationery',
  'Water Bottle',
  'Clothing',
  'Eyewear',
  'Jewellery',
  'Documents',
  'Sports Gear',
  'Other',
];

// SMVDU campus places, grouped for nicer dropdowns (optgroups).
// Edit freely. The flat LOCATIONS list (below) is derived from this and is what
// the Item model validates against.
export const LOCATION_GROUPS = [
  {
    label: 'Boys Hostels',
    options: ['Trikuta', 'Kailash', 'Vindhyanchal', 'Nilgiri', 'Basohli (Old)', 'Basohli (New)'],
  },
  {
    label: 'Girls Hostels',
    options: ['Shivalik A', 'Shivalik B', 'Vaishnavi'],
  },
  {
    label: 'Academic Blocks',
    options: ['Block A', 'Block B', 'Block C', 'Block D'],
  },
  {
    label: 'Lecture Theatres',
    options: ['LT-1', 'LT-2', 'LT-3', 'LT-4'],
  },
  {
    label: 'Food',
    options: ['Grocery', 'Central Mess', 'Campus Bites'],
  },
  {
    label: 'Gates',
    options: ['Gate 1', 'Gate 2'],
  },
  {
    label: 'Other places',
    options: [
      'Prof. N. K. B. M. Library',
      'Admin Block',
      'Sports Complex',
      'Central Gym',
      'Medical Aid Centre',
      'Matrika Auditorium',
      'Bus Stop',
      'Other',
    ],
  },
];

// Flat list of every valid location value (used for model enum + validation).
export const LOCATIONS = LOCATION_GROUPS.flatMap((g) => g.options);

// Item lifecycle (brief §4). `open` is the starting state.
export const ITEM_STATUSES = [
  'open',
  'potential_match',
  'claim_pending',
  'claim_approved',
  'collected',
  'closed',
  'expired',
  'removed',
];

// Finished items: no longer claimable, so they are hidden from the browse feed
// (the record stays in the database and in the admin dashboard).
export const RESOLVED_STATUSES = ['collected', 'closed', 'expired', 'removed'];

// Where a found item is currently held.
export const HELD_BY = ['finder', 'desk'];
