import { describe, expect, it } from 'vitest';
import {
  categoryDeleteCommand,
  categoryRestoreCommand,
  tagDeleteCommand,
  tagRestoreCommand,
  withLifecycleScope,
} from './metadataLifecycleCommands';

describe('metadata lifecycle commands', () => {
  it('keeps the expected version and scope on category restore', () => {
    expect(categoryRestoreCommand({
      categoryId: 'category-1', hostId: null, aggregateVersion: 7,
    })).toEqual({
      host: 'lightapi.net', service: 'category', action: 'restoreCategory', version: '0.1.0',
      data: {
        globalFlag: true, categoryId: 'category-1', aggregateVersion: 7,
      },
    });
  });

  it('keeps the expected version and scope on tag restore', () => {
    expect(tagRestoreCommand({
      tagId: 'tag-1', hostId: 'tenant-a', globalFlag: false, aggregateVersion: 4,
    })).toEqual({
      host: 'lightapi.net', service: 'tag', action: 'restoreTag', version: '0.1.0',
      data: {
        hostId: 'tenant-a', globalFlag: false, tagId: 'tag-1', aggregateVersion: 4,
      },
    });
  });

  it('uses the same derived global scope for delete and update intent', () => {
    expect(categoryDeleteCommand({
      categoryId: 'category-1', hostId: null, aggregateVersion: 7,
    }).data).toEqual({
      globalFlag: true, categoryId: 'category-1', aggregateVersion: 7,
    });
    expect(tagDeleteCommand({
      tagId: 'tag-1', hostId: null, aggregateVersion: 4,
    }).data).toEqual({
      globalFlag: true, tagId: 'tag-1', aggregateVersion: 4,
    });
    expect(withLifecycleScope({
      hostId: null, aggregateVersion: 9, tagId: 'tag-2', tagName: 'release',
    })).toEqual({
      globalFlag: true, aggregateVersion: 9, tagId: 'tag-2', tagName: 'release',
    });
  });
});
