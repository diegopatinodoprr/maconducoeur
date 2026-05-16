import { ObjectId } from 'mongodb';

export type BorrowingStatus = 'pending' | 'active' | 'finished' | 'rejected';

export type BorrowingDocument = {
  _id: ObjectId;
  tool_id: ObjectId;
  start_date: Date;
  end_date: Date;
  borrower_user_id: ObjectId;
  owner_user_id: ObjectId;
  status: BorrowingStatus;
  created_at: Date;
  updated_at: Date;
};
