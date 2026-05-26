import { getPrimaryIconData } from '../src/lib/tag-config';
const place = {
  id: 'test',
  name: 'Imperial Spielhalle',
  categories: ['entertainment', 'entertainment.amusement_arcade', 'wheelchair', 'wheelchair.yes']
};
console.log(getPrimaryIconData(place, 'de'));
