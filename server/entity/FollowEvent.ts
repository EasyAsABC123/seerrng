import { Follow } from '@server/entity/Follow';
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

export interface FollowEventTarget {
  mediaType: string;
  id: string;
  /** Optional variant the request action should preselect. */
  variantKey?: string;
}

/** One item of "personal news", with the reason it exists. */
@Entity()
@Index('UQ_follow_event_follow_dedupe', ['follow', 'dedupeKey'], {
  unique: true,
})
@Index('IDX_follow_event_user_seen', ['user', 'seen'])
export class FollowEvent {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => Follow, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followId' })
  public follow: Follow;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  public user: User;

  @Column({ type: 'varchar', length: 255 })
  public dedupeKey: string;

  /** Stable translation key, e.g. `nextVolumeAnnounced`. */
  @Column({ type: 'varchar', length: 64 })
  public reasonKey: string;

  @Column({ type: 'simple-json', nullable: true })
  public reasonValues?: Record<string, string> | null;

  @Column({ type: 'varchar', length: 255 })
  public title: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  public imageUrl?: string | null;

  @Column({ type: 'simple-json', nullable: true })
  public target?: FollowEventTarget | null;

  @Column({ type: 'boolean', default: false })
  public seen: boolean;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  constructor(init?: Partial<FollowEvent>) {
    Object.assign(this, init);
  }
}

export default FollowEvent;
