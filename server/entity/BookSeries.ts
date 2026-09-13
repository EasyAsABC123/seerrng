import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** Local URL identity is scoped to one configured server endpoint and format. */
@Entity()
@Unique('UQ_book_series_provider', ['provider', 'providerId'])
export default class BookSeries {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  provider: string;

  @Column({ type: 'varchar' })
  providerId: string;

  @Column({ type: 'integer' })
  authorId: number;

  @Column({ type: 'varchar' })
  title: string;
}
