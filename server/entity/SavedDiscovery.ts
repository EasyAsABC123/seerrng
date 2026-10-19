import { User } from '@server/entity/User';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export interface SavedDiscoveryFilters {
  themes?: string[];
  gameModes?: string[];
  perspectives?: string[];
  genres?: string[];
  languages?: string[];
  maxHoursToBeat?: number;
  minYear?: number;
  text?: string;
}

/** A saved, steerable game discovery with visible filters and exclusions. */
@Entity()
@Index('IDX_saved_discovery_user', ['user'])
export class SavedDiscovery {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  public user: User;

  @Column({ type: 'varchar', length: 120 })
  public name: string;

  @Column({ type: 'varchar', length: 16, default: 'game' })
  public mediaType: 'game';

  @Column({ type: 'simple-json' })
  public filters: SavedDiscoveryFilters;

  @Column({ type: 'simple-json', nullable: true })
  public exclusions?: SavedDiscoveryFilters | null;

  @Column({ type: 'boolean', default: true })
  public notify: boolean;

  /** Ids already shown, so only new matches notify. */
  @Column({ type: 'simple-json', nullable: true })
  public knownIds?: string[] | null;

  @DbAwareColumn({ type: 'datetime', nullable: true })
  public lastRunAt?: Date | null;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  constructor(init?: Partial<SavedDiscovery>) {
    Object.assign(this, init);
  }
}

export default SavedDiscovery;
