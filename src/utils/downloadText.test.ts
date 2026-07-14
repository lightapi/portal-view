import { beforeEach, describe, expect, it, vi } from 'vitest';
import downloadText from './downloadText';

describe('downloadText', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('uses exact bytes and always removes the anchor and revokes its URL', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    downloadText('values.yml', 'a: true\n', 'application/yaml;charset=utf-8');
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download="values.yml"]')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  it('cleans up when the synthetic click throws', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => downloadText('values.yml', 'secret\n')).toThrow('blocked');
    expect(document.querySelector('a[download="values.yml"]')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});

