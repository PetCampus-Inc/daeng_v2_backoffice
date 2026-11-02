import { Inject, Injectable } from '@nestjs/common';
import { ApiException } from '../common/api-error.js';
import { IdeaReader, type IdeaFilter, type IdeaRow } from './idea-reader.js';

export interface Idea {
  id: number;
  content: string;
  user: { type: IdeaRow['userType']; name: string; email: string };
  submittedAt: string;
}

export interface IdeaPage {
  items: Idea[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

@Injectable()
export class IdeasService {
  constructor(@Inject(IdeaReader) private readonly reader: IdeaReader) {}

  async list(filter: IdeaFilter, page: number, size: number): Promise<IdeaPage> {
    const { rows, total } = await this.reader.list(filter, page, size);
    return { items: rows.map(toIdea), page, size, totalItems: total, totalPages: Math.ceil(total / size) };
  }

  async detail(id: number): Promise<Idea> {
    const row = await this.reader.get(id);
    if (!row) throw new ApiException(404, 'IDEA_NOT_FOUND', '제안을 찾을 수 없습니다.');
    return toIdea(row);
  }
}

function toIdea(row: IdeaRow): Idea {
  return {
    id: row.id,
    content: row.content,
    user: { type: row.userType, name: row.userName, email: row.userEmail },
    submittedAt: row.submittedAt,
  };
}
