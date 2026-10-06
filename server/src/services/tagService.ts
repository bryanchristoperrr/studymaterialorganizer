/**
 * Service tag: membaca daftar tag beserta jumlah pemakaiannya untuk form filter.
 * Tag dibuat melalui materialService (B9), jadi service ini read-only.
 */
import type { Tag } from '../../shared/types.js';
import type { TagRepository } from '../repositories/tagRepository.js';

export class TagService {
  constructor(private readonly tags: TagRepository) {}

  async list(): Promise<Tag[]> {
    return this.tags.findAll();
  }
}
