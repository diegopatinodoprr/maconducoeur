import { ObjectId } from 'mongodb';

export type MousseLedgerStatus = 'pending' | 'settled' | 'canceled';

export type MousseLedgerDocument = {
  _id: ObjectId;
  borrowing_id: ObjectId;
  tool_id: ObjectId;
  from_user_id: ObjectId;
  to_user_id: ObjectId;
  mousse_amount: number;
  status: MousseLedgerStatus;
  created_at: Date;
  updated_at: Date;
  settled_at?: Date;
  canceled_at?: Date;
};
