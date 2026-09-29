import { describe, it, expect } from 'vitest';
import {
  toTitleCase, normalizeName, findHeaderRow, rowsToAccounts,
  textToRows, matchExistingFuzzy, splitLineToCells,
} from '@/lib/account-import';
import { DEFAULT_CATEGORIES } from '@/lib/fazai-db';

describe('account-import', () => {
  it('title-cases names', () => {
    expect(toTitleCase('kas kecil')).toBe('Kas Kecil');
    expect(toTitleCase('  BANK  bca ')).toBe('BANK Bca'.replace('BANK', 'BANK'));
  });

  it('finds header with free column order', () => {
    const rows = [
      ['PT Maju - Chart of Accounts'],
      ['Saldo', 'Nama Akun', 'Kategori'],
      ['50000', 'kas kecil', 'Kas & Bank'],
    ];
    const h = findHeaderRow(rows);
    expect(h).not.toBeNull();
    expect(h!.map.name).toBe(1);
    expect(h!.map.balance).toBe(0);
    expect(h!.map.category).toBe(2);
  });

  it('parses rows, skips title/footer, guesses category', () => {
    const rows = [
      ['Company XYZ'],
      ['Account Name', 'Category', 'Balance'],
      ['kas kecil', 'Kas & Bank', 'Rp 50.000'],
      ['Beban Gaji', '', '100000'],
      ['Total', '', '150000'],
    ];
    const out = rowsToAccounts(rows, DEFAULT_CATEGORIES);
    expect(out.map(o => o.name)).toEqual(['Kas Kecil', 'Beban Gaji']);
    expect(out[0].categoryId).toBe('cat-cashbank');
    expect(out[0].balance).toBe(50000);
    expect(out[1].needsCategoryConfirm).toBe(true);
  });

  it('handles no-header single column', () => {
    const out = rowsToAccounts([['kas kecil'], ['bank bca']], DEFAULT_CATEGORIES);
    expect(out.length).toBe(2);
    expect(out[0].balance).toBeNull();
  });

  it('splits PDF-style lines', () => {
    expect(splitLineToCells('Kas Kecil   Kas & Bank   50000')).toEqual(['Kas Kecil', 'Kas & Bank', '50000']);
    expect(textToRows('a  b\n\nc').length).toBe(2);
  });

  it('fuzzy-matches existing names', () => {
    const existing: any[] = [{ name: 'Cash', nameId: 'Kas', nameZh: '现金', categoryId: 'cat-cashbank' }];
    expect(matchExistingFuzzy('cash', existing)).not.toBeNull();
    expect(matchExistingFuzzy('  KAS  ', existing)).not.toBeNull();
    expect(normalizeName('Kas  Kecil')).toBe('kas kecil');
  });
});
