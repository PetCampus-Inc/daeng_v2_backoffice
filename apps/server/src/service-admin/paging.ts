export interface PageRequest {
  page: number;
  size: number;
}

export interface Paged<T> {
  total: number;
  rows: T[];
}
