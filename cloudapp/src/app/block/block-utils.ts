import { CardPatron } from '../models/card-api.model';

export function hasDisplayedBlocks(blocks: CardPatron['blocks']): boolean {
  return !!(
    blocks['02'] ||
    blocks['03'] ||
    blocks['03.1'] ||
    blocks['09'] ||
    blocks['08']
  );
}
