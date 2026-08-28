export type BookList = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type ListMembership = {
  list_id: string;
  book_id: string;
  user_id: string;
  position: number;
  added_at: string;
};
