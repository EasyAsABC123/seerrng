import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type RelationConfidence = 'high' | 'moderate' | 'low';
export type RelationKind =
  | 'source-material'
  | 'adaptation'
  | 'sequel'
  | 'prequel'
  | 'side-story'
  | 'soundtrack'
  | 'same-franchise';

/**
 * A directed relationship between two works with its evidence. Uncertain
 * relationships are stored as such; they are never inferred silently.
 */
@Entity()
@Index(
  'UQ_media_relation_edge',
  ['fromType', 'fromId', 'toType', 'toId', 'relation'],
  { unique: true }
)
@Index('IDX_media_relation_from', ['fromType', 'fromId'])
@Index('IDX_media_relation_to', ['toType', 'toId'])
export class MediaRelation {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'varchar', length: 24 })
  public fromType: string;

  @Column({ type: 'varchar', length: 128 })
  public fromId: string;

  @Column({ type: 'varchar', length: 24 })
  public toType: string;

  @Column({ type: 'varchar', length: 128 })
  public toId: string;

  @Column({ type: 'varchar', length: 24 })
  public relation: RelationKind;

  @Column({ type: 'varchar', length: 12, default: 'low' })
  public confidence: RelationConfidence;

  @Column({ type: 'varchar', length: 512, nullable: true })
  public evidence?: string | null;

  @Column({ type: 'varchar', length: 32 })
  public source: string;

  /** Set when an administrator confirmed or corrected the relationship. */
  @Column({ type: 'boolean', default: false })
  public verified: boolean;

  /** Hidden by an administrator; kept so it is not rediscovered. */
  @Column({ type: 'boolean', default: false })
  public rejected: boolean;

  @Column({ type: 'simple-json', nullable: true })
  public data?: Record<string, unknown> | null;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public updatedAt: Date;

  constructor(init?: Partial<MediaRelation>) {
    Object.assign(this, init);
  }
}

export default MediaRelation;
