import { ObjectId } from 'mongodb';
import { ToolCategory } from '../constants/tool-categories.js';

export type ToolDocument = {
  _id: ObjectId;
  nom: string;
  categorie: ToolCategory;
  description?: string;
  localisation_address_id?: ObjectId;
  marque: ObjectId;
  image_file_id?: ObjectId;
  owner_user_id: ObjectId;
  borrowed_by_user_id?: ObjectId;
  etat: 'neuf' | 'bon' | 'use';
  disponible: boolean;
  created_at: Date;
  updated_at: Date;
};
