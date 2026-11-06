import type { Item, Property, Rule } from '../types';
import propertiesJson from './properties.json';
import itemsJson from './items.json';
import overridesJson from './overrides.json';

export const properties: Property[] = propertiesJson as Property[];
export const items: Item[] = itemsJson as Item[];
export const overrides: Record<string, Rule> = overridesJson as Record<string, Rule>;
