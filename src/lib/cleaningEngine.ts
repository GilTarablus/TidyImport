// Target CRM Schema - vcita's standard columns
export const TARGET_HEADERS = [
  "Email",
  "First Name",
  "Last Name",
  "Phone",
  "Address",
  "Birthday",
  "Time Zone",
  "Status",
  "Tags",
  "Notes"
] as const;

export type StandardTargetHeader = typeof TARGET_HEADERS[number];

// TargetHeader can be a standard header OR a custom string
export type TargetHeader = StandardTargetHeader | string;

export interface HeaderMapping {
  sourceHeader: string;
  targetHeader: TargetHeader | null;
  confidence: number; // 0-1
  isCustom?: boolean; // Marks if this is a custom field
}

// Statistics tracked during cleaning
export interface CleaningStats {
  totalRows: number;
  emailsCleaned: number;
  phonesNormalized: number;
  emptyValuesCleared: number;
  namesToProperCase: number;
  totalCellsModified: number;
  statusValidated: number;
  timeZoneValidated: number;
  tagsFormatted: number;
  birthdayFormatted: number;
  addressesConsolidated: number;
  emptyRowsRemoved: number;
  emptyColumnsRemoved: number;
}

// Validation warning for a row
export interface RowValidation {
  rowIndex: number;
  missingFields: TargetHeader[];
  invalidEmail?: boolean;
  invalidStatus?: boolean;
  invalidTimeZone?: boolean;
  missingTimeZone?: boolean;
  firstNameRequired?: boolean;
  firstNameTooLong?: boolean;
  lastNameTooLong?: boolean;
}

// Max character limit for names
export const MAX_NAME_LENGTH = 26;

// Duplicate detection result
export interface DuplicateGroup {
  field: 'Email' | 'Phone';
  value: string;
  rowIndices: number[];
}

// Phone format is always digits-only (no formatting)

// Name prefixes to remove during splitting
export const NAME_PREFIXES = [
  'Mr', 'Mr.', 'Mrs', 'Mrs.', 'Ms', 'Ms.', 'Miss',
  'Dr', 'Dr.', 'Prof', 'Prof.', 'Professor',
  'Rev', 'Rev.', 'Reverend',
  'Hon', 'Hon.', 'Honorable',
  'Sir', 'Dame', 'Lady', 'Lord'
];

// Name suffixes to remove during splitting
export const NAME_SUFFIXES = [
  'Jr', 'Jr.', 'Junior',
  'Sr', 'Sr.', 'Senior',
  'I', 'II', 'III', 'IV', 'V',
  'PhD', 'Ph.D', 'Ph.D.',
  'MD', 'M.D', 'M.D.',
  'DDS', 'D.D.S.',
  'Esq', 'Esq.',
  'CPA', 'RN', 'MBA'
];

// Result of splitting a full name
export interface SplitNameResult {
  firstName: string;
  lastName: string;
  removedPrefix?: string;
  removedSuffix?: string;
}

// Remove prefix from name words
function removePrefix(words: string[]): { cleaned: string[]; removed?: string } {
  if (words.length === 0) return { cleaned: words };
  
  const firstWord = words[0];
  const matchedPrefix = NAME_PREFIXES.find(
    prefix => prefix.toLowerCase() === firstWord.toLowerCase()
  );
  
  if (matchedPrefix) {
    return { cleaned: words.slice(1), removed: matchedPrefix };
  }
  
  return { cleaned: words };
}

// Remove suffix from name words
function removeSuffix(words: string[]): { cleaned: string[]; removed?: string } {
  if (words.length === 0) return { cleaned: words };
  
  const lastWord = words[words.length - 1];
  const matchedSuffix = NAME_SUFFIXES.find(
    suffix => suffix.toLowerCase() === lastWord.toLowerCase()
  );
  
  if (matchedSuffix) {
    return { cleaned: words.slice(0, -1), removed: matchedSuffix };
  }
  
  return { cleaned: words };
}

// Split a full name into first and last name
// Rules after prefix/suffix removal:
// 1 word: First Name only
// 2 words: First Name | Last Name
// 3 words: First Name | Last Name (2 words)
// 4+ words: First Name (2 words) | Last Name (remaining words)
export function splitFullName(fullName: string): SplitNameResult {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: '', lastName: '' };
  }
  
  // Split into words
  let words = fullName.trim().split(/\s+/).filter(w => w.length > 0);
  
  if (words.length === 0) {
    return { firstName: '', lastName: '' };
  }
  
  // Remove prefix
  const prefixResult = removePrefix(words);
  words = prefixResult.cleaned;
  const removedPrefix = prefixResult.removed;
  
  // Remove suffix
  const suffixResult = removeSuffix(words);
  words = suffixResult.cleaned;
  const removedSuffix = suffixResult.removed;
  
  // Handle edge case where prefix/suffix removal leaves no words
  if (words.length === 0) {
    return { firstName: '', lastName: '', removedPrefix, removedSuffix };
  }
  
  let firstName: string;
  let lastName: string;
  
  // Split based on remaining word count
  if (words.length === 1) {
    firstName = words[0];
    lastName = '';
  } else if (words.length === 2) {
    firstName = words[0];
    lastName = words[1];
  } else if (words.length === 3) {
    // If middle word is a single letter (middle initial), skip it
    if (words[1].length === 1 || (words[1].length === 2 && words[1].endsWith('.'))) {
      firstName = words[0];
      lastName = words[2];
    } else {
      firstName = words[0];
      lastName = words.slice(1).join(' ');
    }
  } else {
    // 4+ words: 2 for first name, rest for last name
    firstName = words.slice(0, 2).join(' ');
    lastName = words.slice(2).join(' ');
  }
  
  return { firstName, lastName, removedPrefix, removedSuffix };
}

// Detection result for full name columns
export interface NameSplitDetection {
  sourceHeader: string;
  type: 'full_name' | 'combined_name';
}

// Detect if there's a full name column without separate first/last name columns
export function detectFullNameColumn(headers: string[]): NameSplitDetection | null {
  const lowerHeaders = headers.map(h => h.toLowerCase().replace(/[_\-\s]+/g, ''));
  
  // Check if First Name or Last Name columns already exist
  const hasFirstName = lowerHeaders.some(h => 
    h.includes('firstname') || h === 'fname' || h === 'first'
  );
  const hasLastName = lowerHeaders.some(h => 
    h.includes('lastname') || h === 'lname' || h === 'last'
  );
  
  // If both exist, no need for splitting
  if (hasFirstName && hasLastName) {
    return null;
  }
  
  // Look for combined name columns
  const combinedNamePatterns = [
    { pattern: /^fullname$/i, type: 'full_name' as const },
    { pattern: /^full[\s_-]?name$/i, type: 'full_name' as const },
    { pattern: /^name$/i, type: 'combined_name' as const },
    { pattern: /^client[\s_-]?name$/i, type: 'combined_name' as const },
    { pattern: /^customer[\s_-]?name$/i, type: 'combined_name' as const },
    { pattern: /^contact[\s_-]?name$/i, type: 'combined_name' as const },
    { pattern: /^client$/i, type: 'combined_name' as const },
    { pattern: /^contact$/i, type: 'combined_name' as const },
  ];
  
  for (const header of headers) {
    for (const { pattern, type } of combinedNamePatterns) {
      if (pattern.test(header.trim())) {
        return { sourceHeader: header, type };
      }
    }
  }
  
  return null;
}

// Valid Status values
const VALID_STATUSES = ['Lead', 'Customer', 'VIP'];

// Valid Time Zones - exact values from inTandem template
const VALID_TIME_ZONES = [
  'Abu Dhabi',
  'Adelaide',
  'Alaska',
  'Almaty',
  'American Samoa',
  'Amsterdam',
  'Arizona',
  'Astana',
  'Athens',
  'Atlantic Time (Canada)',
  'Auckland',
  'Azores',
  'Baghdad',
  'Baku',
  'Bangkok',
  'Beijing',
  'Belgrade',
  'Berlin',
  'Bern',
  'Bogota',
  'Brasilia',
  'Bratislava',
  'Brisbane',
  'Brussels',
  'Bucharest',
  'Budapest',
  'Buenos Aires',
  'Cairo',
  'Canberra',
  'Cape Verde Is.',
  'Caracas',
  'Casablanca',
  'Central America',
  'Central Time (US & Canada)',
  'Chatham Is.',
  'Chennai',
  'Chihuahua',
  'Chongqing',
  'Copenhagen',
  'Darwin',
  'Dhaka',
  'Eastern Time (US & Canada)',
  'Edinburgh',
  'Ekaterinburg',
  'Fiji',
  'Georgetown',
  'Greenland',
  'Guadalajara',
  'Guam',
  'Hanoi',
  'Harare',
  'Hawaii',
  'Helsinki',
  'Hobart',
  'Hong Kong',
  'Indiana (East)',
  'International Date Line West',
  'Irkutsk',
  'Islamabad',
  'Istanbul',
  'Jakarta',
  'Jerusalem',
  'Kabul',
  'Kaliningrad',
  'Kamchatka',
  'Karachi',
  'Kathmandu',
  'Kolkata',
  'Krasnoyarsk',
  'Kuala Lumpur',
  'Kuwait',
  'Kyiv',
  'La Paz',
  'Lima',
  'Lisbon',
  'Ljubljana',
  'London',
  'Madrid',
  'Magadan',
  'Marshall Is.',
  'Mazatlan',
  'Melbourne',
  'Mexico City',
  'Mid-Atlantic',
  'Midway Island',
  'Minsk',
  'Monrovia',
  'Monterrey',
  'Montevideo',
  'Moscow',
  'Mountain Time (US & Canada)',
  'Mumbai',
  'Muscat',
  'Nairobi',
  'New Caledonia',
  'New Delhi',
  'Newfoundland',
  'Novosibirsk',
  "Nuku'alofa",
  'Osaka',
  'Pacific Time (US & Canada)',
  'Paris',
  'Perth',
  'Port Moresby',
  'Prague',
  'Pretoria',
  'Quito',
  'Rangoon',
  'Riga',
  'Riyadh',
  'Rome',
  'Samara',
  'Samoa',
  'Santiago',
  'Sapporo',
  'Sarajevo',
  'Saskatchewan',
  'Seoul',
  'Singapore',
  'Skopje',
  'Sofia',
  'Solomon Is.',
  'Srednekolymsk',
  'Sri Jayawardenepura',
  'St. Petersburg',
  'Stockholm',
  'Sydney',
  'Taipei',
  'Tallinn',
  'Tashkent',
  'Tbilisi',
  'Tehran',
  'Tijuana',
  'Tokelau Is.',
  'Tokyo',
  'Ulaanbaatar',
  'Urumqi',
  'UTC',
  'Vienna',
  'Vilnius',
  'Vladivostok',
  'Volgograd',
  'Warsaw',
  'Wellington',
  'West Central Africa',
  'Yakutsk',
  'Yerevan',
  'Zagreb'
];

// Timezone aliases - map common variations to valid inTandem values
const TIMEZONE_ALIASES: Record<string, string> = {
  // US Eastern variations
  'est': 'Eastern Time (US & Canada)',
  'edt': 'Eastern Time (US & Canada)',
  'eastern': 'Eastern Time (US & Canada)',
  'eastern time': 'Eastern Time (US & Canada)',
  'eastern standard time': 'Eastern Time (US & Canada)',
  'eastern daylight time': 'Eastern Time (US & Canada)',
  'et': 'Eastern Time (US & Canada)',
  'america/new_york': 'Eastern Time (US & Canada)',
  'new york': 'Eastern Time (US & Canada)',
  'us/eastern': 'Eastern Time (US & Canada)',
  
  // US Central variations
  'cst': 'Central Time (US & Canada)',
  'cdt': 'Central Time (US & Canada)',
  'central': 'Central Time (US & Canada)',
  'central time': 'Central Time (US & Canada)',
  'central standard time': 'Central Time (US & Canada)',
  'central daylight time': 'Central Time (US & Canada)',
  'ct': 'Central Time (US & Canada)',
  'america/chicago': 'Central Time (US & Canada)',
  'chicago': 'Central Time (US & Canada)',
  'us/central': 'Central Time (US & Canada)',
  
  // US Mountain variations
  'mst': 'Mountain Time (US & Canada)',
  'mdt': 'Mountain Time (US & Canada)',
  'mountain': 'Mountain Time (US & Canada)',
  'mountain time': 'Mountain Time (US & Canada)',
  'mountain standard time': 'Mountain Time (US & Canada)',
  'mountain daylight time': 'Mountain Time (US & Canada)',
  'mt': 'Mountain Time (US & Canada)',
  'america/denver': 'Mountain Time (US & Canada)',
  'denver': 'Mountain Time (US & Canada)',
  'us/mountain': 'Mountain Time (US & Canada)',
  
  // US Pacific variations
  'pst': 'Pacific Time (US & Canada)',
  'pdt': 'Pacific Time (US & Canada)',
  'pacific': 'Pacific Time (US & Canada)',
  'pacific time': 'Pacific Time (US & Canada)',
  'pacific standard time': 'Pacific Time (US & Canada)',
  'pacific daylight time': 'Pacific Time (US & Canada)',
  'pt': 'Pacific Time (US & Canada)',
  'america/los_angeles': 'Pacific Time (US & Canada)',
  'los angeles': 'Pacific Time (US & Canada)',
  'la': 'Pacific Time (US & Canada)',
  'us/pacific': 'Pacific Time (US & Canada)',
  
  // US Alaska variations
  'akst': 'Alaska',
  'akdt': 'Alaska',
  'alaska time': 'Alaska',
  'america/anchorage': 'Alaska',
  'us/alaska': 'Alaska',
  
  // US Hawaii variations
  'hst': 'Hawaii',
  'hast': 'Hawaii',
  'hawaiian': 'Hawaii',
  'hawaii time': 'Hawaii',
  'pacific/honolulu': 'Hawaii',
  'us/hawaii': 'Hawaii',
  
  // US Arizona
  'america/phoenix': 'Arizona',
  'phoenix': 'Arizona',
  'us/arizona': 'Arizona',
  
  // Canada Atlantic
  'atlantic': 'Atlantic Time (Canada)',
  'ast': 'Atlantic Time (Canada)',
  'adt': 'Atlantic Time (Canada)',
  'america/halifax': 'Atlantic Time (Canada)',
  'canada/atlantic': 'Atlantic Time (Canada)',
  
  // Indiana
  'indiana': 'Indiana (East)',
  'america/indiana': 'Indiana (East)',
  
  // Europe/UK variations
  'gmt': 'London',
  'bst': 'London',
  'uk': 'London',
  'britain': 'London',
  'europe/london': 'London',
  'greenwich': 'London',
  
  // Europe variations
  'cet': 'Paris',
  'cest': 'Paris',
  'france': 'Paris',
  'europe/paris': 'Paris',
  
  'germany': 'Berlin',
  'europe/berlin': 'Berlin',
  
  // Asia variations
  'jst': 'Tokyo',
  'japan': 'Tokyo',
  'asia/tokyo': 'Tokyo',
  
  'china': 'Beijing',
  'shanghai': 'Beijing',
  'asia/shanghai': 'Beijing',
  
  'india': 'New Delhi',
  'ist': 'New Delhi',
  'asia/kolkata': 'Kolkata',
  
  // Australia variations
  'aest': 'Sydney',
  'aedt': 'Sydney',
  'australia': 'Sydney',
  'australia/sydney': 'Sydney',
};

// Sanitize cell values to prevent CSV injection
export function sanitizeForExport(value: string): string {
  if (!value || typeof value !== 'string') return value;
  
  // If the value starts with formula characters, prefix with single quote
  const formulaCharacters = ['=', '+', '-', '@', '\t', '\r'];
  if (formulaCharacters.some(char => value.startsWith(char))) {
    return `'${value}`;
  }
  
  return value;
}

// Validate email structure
export function validateEmailFormat(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  // Basic email validation: must have @ and at least one dot after @
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate Status value
export function validateStatus(status: string): boolean {
  if (!status || typeof status !== 'string') return true; // Empty is valid
  return VALID_STATUSES.some(s => s.toLowerCase() === status.toLowerCase());
}

// Validate Time Zone value
export function validateTimeZone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== 'string') return true; // Empty is valid
  return VALID_TIME_ZONES.some(tz => tz.toLowerCase() === timeZone.toLowerCase());
}

// Format phone number: strip all non-numeric characters, keep as simple digit string
// Supports international numbers of any length
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters (dashes, dots, parentheses, spaces, plus signs)
  return phone.replace(/\D/g, '');
}

// Proper case conversion: "JOHN" or "john" -> "John"
function toProperCase(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Clean phone: remove all non-numeric characters
function cleanPhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '');
}

// Clean email: lowercase and remove internal spaces
function cleanEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return email.toLowerCase().replace(/\s/g, '');
}

// Clean Status: normalize to proper case
function cleanStatus(status: string): string {
  if (!status || typeof status !== 'string') return '';
  const normalized = status.trim().toLowerCase();
  
  // Match against valid statuses
  for (const validStatus of VALID_STATUSES) {
    if (validStatus.toLowerCase() === normalized) {
      return validStatus;
    }
  }
  
  // Return original if not valid (will be flagged in validation)
  return status.trim();
}

// Clean Tags: ensure pipe-separated format
function cleanTags(tags: string): string {
  if (!tags || typeof tags !== 'string') return '';
  
  // Handle various separators and normalize to pipe
  return tags
    .split(/[,;|]/)
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
    .join('|');
}

// Clean Time Zone: normalize to valid format with smart mapping
function cleanTimeZone(timeZone: string): string {
  if (!timeZone || typeof timeZone !== 'string') return '';
  const normalized = timeZone.trim();
  const lowerNormalized = normalized.toLowerCase();
  
  // First, check if it's already a valid timezone (case-insensitive)
  for (const validTz of VALID_TIME_ZONES) {
    if (validTz.toLowerCase() === lowerNormalized) {
      return validTz;
    }
  }
  
  // Check against aliases for smart mapping
  if (TIMEZONE_ALIASES[lowerNormalized]) {
    return TIMEZONE_ALIASES[lowerNormalized];
  }
  
  // Try partial matching for common patterns
  for (const [alias, validTz] of Object.entries(TIMEZONE_ALIASES)) {
    if (lowerNormalized.includes(alias) || alias.includes(lowerNormalized)) {
      return validTz;
    }
  }
  
  // Return original if not valid (will be flagged in validation)
  return normalized;
}

// Birthday format type
export type BirthdayFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY/MM/DD';

// Parse birthday into components { month, day, year }
// Month name mappings for text date parsing
const MONTH_NAMES: Record<string, string> = {
  'jan': '01', 'january': '01',
  'feb': '02', 'february': '02',
  'mar': '03', 'march': '03',
  'apr': '04', 'april': '04',
  'may': '05',
  'jun': '06', 'june': '06',
  'jul': '07', 'july': '07',
  'aug': '08', 'august': '08',
  'sep': '09', 'sept': '09', 'september': '09',
  'oct': '10', 'october': '10',
  'nov': '11', 'november': '11',
  'dec': '12', 'december': '12',
};

function parseBirthday(birthday: string): { month: string; day: string; year: string } | null {
  if (!birthday || typeof birthday !== 'string') return null;
  const trimmed = birthday.trim();
  
  // Try YYYY-MM-DD or YYYY/MM/DD pattern first (ISO format - unambiguous)
  const isoMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return { 
      month: month.padStart(2, '0'), 
      day: day.padStart(2, '0'), 
      year 
    };
  }
  
  // Try XX/XX/YYYY or XX-XX-YYYY pattern
  const slashMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    const [, first, second, year] = slashMatch;
    const firstNum = parseInt(first, 10);
    const secondNum = parseInt(second, 10);
    
    // If first number > 12, it must be a day (DD/MM/YYYY)
    if (firstNum > 12 && secondNum <= 12) {
      return { 
        month: second.padStart(2, '0'), 
        day: first.padStart(2, '0'), 
        year 
      };
    }
    // If second number > 12, first must be month (MM/DD/YYYY)
    if (secondNum > 12 && firstNum <= 12) {
      return { 
        month: first.padStart(2, '0'), 
        day: second.padStart(2, '0'), 
        year 
      };
    }
    // Both could be valid - default to MM/DD/YYYY (US standard)
    return { 
      month: first.padStart(2, '0'), 
      day: second.padStart(2, '0'), 
      year 
    };
  }
  
  // Try text date formats: "Jan 6 1975", "January 6, 1975", "6 Jan 1975", etc.
  // Pattern: Month Day Year
  const textMatch1 = trimmed.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (textMatch1) {
    const [, monthText, day, year] = textMatch1;
    const month = MONTH_NAMES[monthText.toLowerCase()];
    if (month) {
      return { month, day: day.padStart(2, '0'), year };
    }
  }
  
  // Pattern: Day Month Year
  const textMatch2 = trimmed.match(/^(\d{1,2})\s+([a-zA-Z]+),?\s+(\d{4})$/);
  if (textMatch2) {
    const [, day, monthText, year] = textMatch2;
    const month = MONTH_NAMES[monthText.toLowerCase()];
    if (month) {
      return { month, day: day.padStart(2, '0'), year };
    }
  }
  
  return null;
}

// Format birthday components to target format
function formatBirthdayToTarget(components: { month: string; day: string; year: string }, format: BirthdayFormat): string {
  const { month, day, year } = components;
  switch (format) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'YYYY/MM/DD':
      return `${year}/${month}/${day}`;
    default:
      return `${month}/${day}/${year}`;
  }
}

// Clean Birthday: normalize date format (default MM/DD/YYYY)
function cleanBirthday(birthday: string): string {
  const components = parseBirthday(birthday);
  if (components) {
    return formatBirthdayToTarget(components, 'MM/DD/YYYY');
  }
  // Return original if can't parse
  return birthday?.trim() || '';
}

// Reformat all birthdays in data to the specified format
export function reformatBirthdays(
  data: Record<string, string>[], 
  format: BirthdayFormat
): Record<string, string>[] {
  return data.map((row) => {
    const birthday = row['Birthday'];
    if (!birthday) return row;
    
    const components = parseBirthday(birthday);
    if (components) {
      const formatted = formatBirthdayToTarget(components, format);
      return { ...row, 'Birthday': formatted };
    }
    return row;
  });
}

// Check if value should be treated as empty
function isEmptyValue(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '' || normalized === 'n/a' || normalized === 'null' || normalized === 'undefined';
}

// Apply surgical cleaning to a single cell based on the target column
// Returns [cleanedValue, wasModified]
export function cleanCell(value: any, targetHeader: TargetHeader | null): [string, boolean] {
  const originalValue = String(value ?? '').trim();
  
  // First, handle empty values
  if (isEmptyValue(value)) {
    const wasEmpty = originalValue !== '';
    return ['', wasEmpty];
  }
  
  let cleaned = originalValue;
  
  if (!targetHeader) return [cleaned, false];
  
// Apply specific cleaning rules based on target column
  // Only apply cleaning for standard headers, custom fields pass through unchanged
  if (TARGET_HEADERS.includes(targetHeader as StandardTargetHeader)) {
    switch (targetHeader as StandardTargetHeader) {
      case "First Name":
      case "Last Name":
        cleaned = toProperCase(originalValue);
        break;
      
      case "Email":
        cleaned = cleanEmail(originalValue);
        break;
      
      case "Phone":
        cleaned = cleanPhone(originalValue);
        break;
      
      case "Status":
        cleaned = cleanStatus(originalValue);
        break;
      
      case "Tags":
        cleaned = cleanTags(originalValue);
        break;
      
      case "Time Zone":
        cleaned = cleanTimeZone(originalValue);
        break;
      
      case "Birthday":
        cleaned = cleanBirthday(originalValue);
        break;
      
      case "Address":
      case "Notes":
      default:
        cleaned = originalValue;
        break;
    }
  } else {
    // Custom field: pass through unchanged
    cleaned = originalValue;
  }
  
  return [cleaned, cleaned !== originalValue];
}

// Process all rows with the given mapping, returning data and statistics
export function processData(
  rows: Record<string, any>[],
  mappings: HeaderMapping[]
): { data: Record<string, string>[]; stats: CleaningStats } {
  const stats: CleaningStats = {
    totalRows: rows.length,
    emailsCleaned: 0,
    phonesNormalized: 0,
    emptyValuesCleared: 0,
    namesToProperCase: 0,
    totalCellsModified: 0,
    statusValidated: 0,
    timeZoneValidated: 0,
    tagsFormatted: 0,
    birthdayFormatted: 0,
    addressesConsolidated: 0,
    emptyRowsRemoved: 0,
    emptyColumnsRemoved: 0,
  };

  // Collect all target headers (standard + custom)
  const allTargetHeaders: string[] = [...TARGET_HEADERS];
  mappings.forEach(m => {
    if (m.targetHeader && m.isCustom && !allTargetHeaders.includes(m.targetHeader)) {
      allTargetHeaders.push(m.targetHeader);
    }
  });

  const data = rows.map(row => {
    const cleanedRow: Record<string, string> = {};
    
    // Initialize all target headers with empty strings
    allTargetHeaders.forEach(header => {
      cleanedRow[header] = '';
    });
    
    // Apply mappings and clean data
    mappings.forEach(mapping => {
      if (mapping.targetHeader && mapping.sourceHeader) {
        const rawValue = row[mapping.sourceHeader];
        const [cleanedValue, wasModified] = cleanCell(rawValue, mapping.targetHeader);
        cleanedRow[mapping.targetHeader] = cleanedValue;
        
        if (wasModified) {
          stats.totalCellsModified++;
          
          // Only track stats for standard headers
          if (TARGET_HEADERS.includes(mapping.targetHeader as StandardTargetHeader)) {
            switch (mapping.targetHeader as StandardTargetHeader) {
              case "Email":
                stats.emailsCleaned++;
                break;
              case "Phone":
                stats.phonesNormalized++;
                break;
              case "First Name":
              case "Last Name":
                stats.namesToProperCase++;
                break;
              case "Status":
                stats.statusValidated++;
                break;
              case "Time Zone":
                stats.timeZoneValidated++;
                break;
              case "Tags":
                stats.tagsFormatted++;
                break;
              case "Birthday":
                stats.birthdayFormatted++;
                break;
            }
          }
          
          // Check if it was cleared
          if (cleanedValue === '' && rawValue) {
            stats.emptyValuesCleared++;
          }
        }
      }
    });
    
    return cleanedRow;
  });

  // Filter out rows where all values are empty
  const filteredData = data.filter(row => {
    const hasData = Object.values(row).some(value => value && value.trim() !== '');
    if (!hasData) {
      stats.emptyRowsRemoved++;
    }
    return hasData;
  });

  // Find and remove columns that have no data in any row
  const columnsWithData = new Set<string>();
  filteredData.forEach(row => {
    Object.entries(row).forEach(([key, value]) => {
      if (value && value.trim() !== '') {
        columnsWithData.add(key);
      }
    });
  });

  // Get all columns and find empty ones
  const allColumns = filteredData.length > 0 ? Object.keys(filteredData[0]) : [];
  const emptyColumns = allColumns.filter(col => !columnsWithData.has(col));
  stats.emptyColumnsRemoved = emptyColumns.length;

  // Remove empty columns from each row
  const cleanedData = filteredData.map(row => {
    const cleanedRow: Record<string, string> = {};
    Object.entries(row).forEach(([key, value]) => {
      if (columnsWithData.has(key)) {
        cleanedRow[key] = value;
      }
    });
    return cleanedRow;
  });

  // Update total rows to reflect filtered count
  stats.totalRows = cleanedData.length;

  return { data: cleanedData, stats };
}

// Validate rows for missing critical fields and invalid values
export function validateRows(data: Record<string, string>[]): RowValidation[] {
  const warnings: RowValidation[] = [];

  data.forEach((row, index) => {
    const missingFields: TargetHeader[] = [];
    let invalidEmail = false;
    let invalidStatus = false;
    let invalidTimeZone = false;
    let missingTimeZone = false;
    let firstNameRequired = false;
    let firstNameTooLong = false;
    let lastNameTooLong = false;
    
    // First Name is REQUIRED
    const firstName = row['First Name']?.trim() || '';
    if (!firstName) {
      missingFields.push('First Name');
      firstNameRequired = true;
    } else if (firstName.length > MAX_NAME_LENGTH) {
      firstNameTooLong = true;
    }
    
    // Last Name length check
    const lastName = row['Last Name']?.trim() || '';
    if (lastName.length > MAX_NAME_LENGTH) {
      lastNameTooLong = true;
    }
    
    // Check other critical fields (optional but flagged if missing)
    const optionalCriticalFields: TargetHeader[] = ['Email', 'Phone', 'Last Name'];
    optionalCriticalFields.forEach(field => {
      if (!row[field] || row[field].trim() === '') {
        missingFields.push(field);
      }
    });
    
    // Validate email format
    const email = row['Email'];
    if (email && email.trim() !== '' && !validateEmailFormat(email)) {
      invalidEmail = true;
    }
    
    // Validate Status
    const status = row['Status'];
    if (status && status.trim() !== '' && !validateStatus(status)) {
      invalidStatus = true;
    }
    
    // Validate Time Zone
    const timeZone = row['Time Zone'];
    if (!timeZone || timeZone.trim() === '') {
      missingTimeZone = true;
    } else if (!validateTimeZone(timeZone)) {
      invalidTimeZone = true;
    }
    
    if (missingFields.length > 0 || invalidEmail || invalidStatus || invalidTimeZone || missingTimeZone || firstNameTooLong || lastNameTooLong) {
      warnings.push({ 
        rowIndex: index, 
        missingFields, 
        invalidEmail,
        invalidStatus,
        invalidTimeZone,
        missingTimeZone,
        firstNameRequired,
        firstNameTooLong,
        lastNameTooLong
      });
    }
  });

  return warnings;
}

// Get rows with missing timezones
export function getRowsWithMissingTimezone(data: Record<string, string>[]): number[] {
  return data
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !row['Time Zone'] || row['Time Zone'].trim() === '')
    .map(({ index }) => index);
}

// Get rows with missing status
export function getRowsWithMissingStatus(data: Record<string, string>[]): number[] {
  return data
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !row['Status'] || row['Status'].trim() === '')
    .map(({ index }) => index);
}

// Get rows with invalid status (non-empty but not in valid list)
export function getRowsWithInvalidStatus(data: Record<string, string>[]): number[] {
  return data
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const status = row['Status']?.trim();
      return status && status !== '' && !validateStatus(status);
    })
    .map(({ index }) => index);
}

// Get valid statuses list for external use
export function getValidStatuses(): string[] {
  return [...VALID_STATUSES];
}

// Get rows with names that exceed max length (these will be skipped)
export function getRowsWithNameTooLong(data: Record<string, string>[]): number[] {
  return data
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const firstName = row['First Name']?.trim() || '';
      const lastName = row['Last Name']?.trim() || '';
      return firstName.length > MAX_NAME_LENGTH || lastName.length > MAX_NAME_LENGTH;
    })
    .map(({ index }) => index);
}

// Detect duplicate contacts by email only
export function detectDuplicates(data: Record<string, string>[]): DuplicateGroup[] {
  const emailMap = new Map<string, number[]>();
  const duplicates: DuplicateGroup[] = [];

  data.forEach((row, index) => {
    const email = row['Email']?.toLowerCase().trim();

    if (email) {
      if (!emailMap.has(email)) {
        emailMap.set(email, []);
      }
      emailMap.get(email)!.push(index);
    }
  });

  // Find duplicates (email only)
  emailMap.forEach((indices, value) => {
    if (indices.length > 1) {
      duplicates.push({ field: 'Email', value, rowIndices: indices });
    }
  });

  return duplicates;
}

// Get sample values for a column (2-3 non-empty values)
export function getSampleValues(rows: Record<string, any>[], header: string, maxSamples = 3): string[] {
  const samples: string[] = [];
  
  for (const row of rows) {
    if (samples.length >= maxSamples) break;
    
    const value = row[header];
    if (value && !isEmptyValue(value)) {
      const strValue = String(value).trim();
      if (strValue && !samples.includes(strValue)) {
        samples.push(strValue.length > 30 ? strValue.substring(0, 27) + '...' : strValue);
      }
    }
  }
  
  return samples;
}

// Address component detection patterns
export interface AddressComponent {
  sourceHeader: string;
  role: 'street1' | 'street2' | 'city' | 'state' | 'zip' | 'country' | 'address';
  order: number;
}

// Detect address component columns from headers
// This detects ALL address-related columns including standalone "Address" columns
// so users can consolidate them all into a single field
export function detectAddressComponentColumns(headers: string[]): AddressComponent[] {
  // Order: address components in logical address order
  const patterns: { role: AddressComponent['role']; regex: RegExp; order: number }[] = [
    // Street address line 1 (including standalone "Address" which likely has street info)
    { role: 'street1', regex: /^(street|addr(ess)?[\s_]?1|street[\s_]?1|line[\s_]?1|address[\s_]line[\s_]?1)$/i, order: 0 },
    // Standalone "Address" - often contains full or partial street address
    { role: 'address', regex: /^address$/i, order: 1 },
    // Street address line 2
    { role: 'street2', regex: /^(addr(ess)?[\s_]?2|street[\s_]?2|line[\s_]?2|apt|suite|unit|apartment|address[\s_]line[\s_]?2)$/i, order: 2 },
    // City
    { role: 'city', regex: /^(city|town|municipality|locality)$/i, order: 3 },
    // State/Province
    { role: 'state', regex: /^(state|province|region|st|prov)$/i, order: 4 },
    // Zip/Postal code
    { role: 'zip', regex: /^(zip|postal|postcode|zip[\s_]?code|postal[\s_]?code)$/i, order: 5 },
    // Country
    { role: 'country', regex: /^(country|nation|ctry)$/i, order: 6 },
  ];

  const components: AddressComponent[] = [];

  headers.forEach(header => {
    const normalized = header.trim();
    
    for (const { role, regex, order } of patterns) {
      if (regex.test(normalized)) {
        components.push({
          sourceHeader: header,
          role,
          order,
        });
        break;
      }
    }
  });

  // Sort by order for proper address sequencing
  return components.sort((a, b) => a.order - b.order);
}

// Consolidate address from multiple components
export function consolidateAddress(
  row: Record<string, string>,
  components: AddressComponent[],
  separator: string = ', '
): string {
  return components
    .sort((a, b) => a.order - b.order)
    .map(comp => row[comp.sourceHeader]?.trim())
    .filter(val => val && val.length > 0)
    .join(separator)
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

// Export valid values for UI display
export { VALID_STATUSES, VALID_TIME_ZONES };
