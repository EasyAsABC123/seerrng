import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity()
@Unique('UQ_book_series_watch_target', ['scope', 'providerId'])
export default class BookSeriesWatchRequest {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar' }) scope: string;
  @Column({ type: 'varchar' }) providerId: string;
  @Column({ type: 'integer' }) serverId: number;
  @Column({ type: 'varchar' }) title: string;
  @Column({ type: 'varchar' }) format: 'ebook' | 'audiobook';
  @Column({ type: 'integer' }) requestedById: number;
  @Column({ type: 'integer', nullable: true }) approvedById: number | null;
  @Column({ type: 'boolean', default: false }) includeExtras: boolean;
  @Column({ type: 'varchar' }) status:
    'pending' | 'active' | 'failed' | 'declined' | 'stopped';
  @Column({ type: 'integer', nullable: true }) backendWatchId: number | null;
}
