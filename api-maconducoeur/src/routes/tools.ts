import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { TOOL_CATEGORIES, isToolCategory } from '../constants/tool-categories.js';
import { getDb } from '../db/pool.js';
import { AuthenticatedRequest, requireAuth, requireAdmin } from '../middlewares/auth.js';
import { emitAppEvent } from '../realtime/events.js';
import { ToolDocument } from '../types/tool.js';

const router = Router();

type ManufacturerDocument = {
  _id: ObjectId;
  nom: string;
  pays?: string;
  site_web?: string;
  icon?: string;
  created_at: Date;
  updated_at: Date;
};

type UserDocument = {
  _id: ObjectId;
  first_name: string;
  last_name: string;
  email: string;
  credits?: number;
};

type AddressDocument = {
  _id: ObjectId;
  user_id: ObjectId;
  label: string;
  rue: string;
  ville: string;
  code_postal: string;
};

router.get('/utils', async (_req, res) => {
  try {
    const db = await getDb();
    const tools = await db
      .collection<ToolDocument>('utils')
      .aggregate<
        ToolDocument & {
          manufacturer?: { _id: ObjectId; nom: string }[];
          image_file?: { _id: ObjectId; url: string }[];
          owner_user?: UserDocument[];
          borrowed_by_user?: UserDocument[];
          localisation_address?: AddressDocument[];
        }
      >([
        { $sort: { created_at: -1 } },
        {
          $lookup: {
            from: 'manufacturers',
            localField: 'marque',
            foreignField: '_id',
            as: 'manufacturer'
          }
        },
        {
          $lookup: {
            from: 'files',
            localField: 'image_file_id',
            foreignField: '_id',
            as: 'image_file'
          }
        },
        {
          $lookup: {
            from: 'addresses',
            localField: 'localisation_address_id',
            foreignField: '_id',
            as: 'localisation_address'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'owner_user_id',
            foreignField: '_id',
            as: 'owner_user'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'borrowed_by_user_id',
            foreignField: '_id',
            as: 'borrowed_by_user'
          }
        }
      ])
      .toArray();

    res.json(
      tools.map((tool) => ({
        id: tool._id.toHexString(),
        nom: tool.nom,
        categorie: tool.categorie,
        description: tool.description ?? null,
        localisation_address_id: tool.localisation_address_id?.toHexString?.() ?? null,
        localisation_address: tool.localisation_address?.[0]
          ? {
              id: tool.localisation_address[0]._id.toHexString(),
              user_id: tool.localisation_address[0].user_id.toHexString(),
              label: tool.localisation_address[0].label,
              rue: tool.localisation_address[0].rue,
              ville: tool.localisation_address[0].ville,
              code_postal: tool.localisation_address[0].code_postal
            }
          : null,
        marque_id: tool.marque?.toHexString?.() ?? null,
        marque: tool.manufacturer?.[0]?.nom ?? null,
        image_file_id: tool.image_file_id?.toHexString?.() ?? null,
        image_url: tool.image_file?.[0]?.url ?? null,
        owner_user_id: tool.owner_user_id?.toHexString?.() ?? null,
        owner_user: tool.owner_user?.[0]
          ? {
              id: tool.owner_user[0]._id.toHexString(),
              first_name: tool.owner_user[0].first_name,
              last_name: tool.owner_user[0].last_name,
              email: tool.owner_user[0].email
            }
          : null,
        borrowed_by_user_id: tool.borrowed_by_user_id?.toHexString?.() ?? null,
        borrowed_by_user: tool.borrowed_by_user?.[0]
          ? {
              id: tool.borrowed_by_user[0]._id.toHexString(),
              first_name: tool.borrowed_by_user[0].first_name,
              last_name: tool.borrowed_by_user[0].last_name,
              email: tool.borrowed_by_user[0].email
            }
          : null,
        etat: tool.etat,
        disponible: tool.disponible,
        created_at: tool.created_at,
        updated_at: tool.updated_at
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.post('/utils', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { nom, categorie, description, localisation_address_id, marque_id, owner_user_id, borrowed_by_user_id, etat, disponible } = req.body as {
    nom?: string;
    categorie?: string;
    description?: string;
    localisation_address_id?: string;
    marque_id?: string;
    owner_user_id?: string;
    borrowed_by_user_id?: string;
    etat?: 'neuf' | 'bon' | 'use';
    disponible?: boolean;
  };

  const isAdmin = authReq.auth?.role === 'admin';
  const requestedOwnerUserId = owner_user_id || authReq.auth?.sub;

  if (!nom || !categorie || !marque_id || !requestedOwnerUserId || !localisation_address_id) {
    res.status(400).json({ message: 'Les champs nom, categorie, marque_id, owner_user_id et localisation_address_id sont requis' });
    return;
  }

  if (!isToolCategory(categorie)) {
    res.status(400).json({ message: `Categorie invalide. Categories autorisees: ${TOOL_CATEGORIES.join(', ')}` });
    return;
  }

  if (!ObjectId.isValid(marque_id)) {
    res.status(400).json({ message: 'marque_id invalide' });
    return;
  }

  if (!ObjectId.isValid(requestedOwnerUserId)) {
    res.status(400).json({ message: 'owner_user_id invalide' });
    return;
  }
  if (!ObjectId.isValid(localisation_address_id)) {
    res.status(400).json({ message: 'localisation_address_id invalide' });
    return;
  }

  if (!isAdmin && requestedOwnerUserId !== authReq.auth?.sub) {
    res.status(403).json({ message: 'Un utilisateur ne peut creer un outil que pour lui-meme' });
    return;
  }

  if (borrowed_by_user_id && !ObjectId.isValid(borrowed_by_user_id)) {
    res.status(400).json({ message: 'borrowed_by_user_id invalide' });
    return;
  }

  const validEtats = ['neuf', 'bon', 'use'];
  if (etat && !validEtats.includes(etat)) {
    res.status(400).json({ message: 'Etat invalide (neuf, bon, use)' });
    return;
  }

  try {
    const db = await getDb();
    const manufacturerId = new ObjectId(marque_id);
    const ownerUserId = new ObjectId(requestedOwnerUserId);
    const localisationAddressId = new ObjectId(localisation_address_id);
    const borrowedByUserId = borrowed_by_user_id ? new ObjectId(borrowed_by_user_id) : undefined;

    const [manufacturer, ownerUser, borrowedUser, address] = await Promise.all([
      db.collection<ManufacturerDocument>('manufacturers').findOne({ _id: manufacturerId }),
      db.collection<UserDocument>('users').findOne({ _id: ownerUserId }),
      borrowedByUserId ? db.collection<UserDocument>('users').findOne({ _id: borrowedByUserId }) : Promise.resolve(null),
      db.collection<AddressDocument>('addresses').findOne({ _id: localisationAddressId })
    ]);

    if (!manufacturer) {
      res.status(400).json({ message: 'La marque referencee n\'existe pas' });
      return;
    }

    if (!ownerUser) {
      res.status(400).json({ message: 'Le proprietaire reference n\'existe pas' });
      return;
    }

    if (borrowedByUserId && !borrowedUser) {
      res.status(400).json({ message: 'L\'emprunteur reference n\'existe pas' });
      return;
    }
    if (!address) {
      res.status(400).json({ message: 'L\'adresse de localisation referencee n\'existe pas' });
      return;
    }

    const now = new Date();
    const doc: Omit<ToolDocument, '_id'> = {
      nom: nom.trim(),
      categorie,
      description: description?.trim() || undefined,
      localisation_address_id: localisationAddressId,
      marque: manufacturerId,
      owner_user_id: ownerUserId,
      borrowed_by_user_id: borrowedByUserId,
      etat: etat ?? 'bon',
      disponible: borrowedByUserId ? false : (disponible ?? true),
      created_at: now,
      updated_at: now
    };

    const result = await db.collection('utils').insertOne(doc);
    await db.collection<UserDocument>('users').updateOne(
      { _id: ownerUserId },
      { $inc: { credits: 10 } }
    );
    const createdToolId = result.insertedId.toHexString();
    emitAppEvent({
      type: 'tool.created',
      actor_user_id: authReq.auth?.sub ?? null,
      entity_id: createdToolId,
      payload: { owner_user_id: ownerUserId.toHexString() }
    });

    res.status(201).json({
      id: createdToolId,
      ...doc,
      marque_id: manufacturerId.toHexString(),
      marque: manufacturer.nom,
      owner_user_id: ownerUserId.toHexString(),
      borrowed_by_user_id: borrowedByUserId?.toHexString?.() ?? null,
      localisation_address_id: localisationAddressId.toHexString(),
      localisation_address: {
        id: address._id.toHexString(),
        user_id: address.user_id.toHexString(),
        label: address.label,
        rue: address.rue,
        ville: address.ville,
        code_postal: address.code_postal
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.delete('/utils/:id', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const toolId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!ObjectId.isValid(toolId)) {
    res.status(400).json({ message: 'ID outil invalide' });
    return;
  }

  try {
    const db = await getDb();
    const existing = await db.collection<ToolDocument>('utils').findOne({ _id: new ObjectId(toolId) });
    if (!existing) {
      res.status(404).json({ message: 'Outil introuvable' });
      return;
    }

    const isOwner = existing.owner_user_id.toHexString() === authReq.auth?.sub;
    const isAdmin = authReq.auth?.role === 'admin';
    if (!isOwner && !isAdmin) {
      res.status(403).json({ message: 'Acces refuse: seul le proprietaire peut supprimer cet outil' });
      return;
    }

    if (existing.borrowed_by_user_id) {
      res.status(409).json({ message: 'Suppression impossible: outil actuellement emprunte' });
      return;
    }

    await db.collection('utils').deleteOne({ _id: existing._id });
    await db.collection<UserDocument>('users').updateOne(
      { _id: existing.owner_user_id },
      { $inc: { credits: -5 } }
    );

    emitAppEvent({
      type: 'tool.updated',
      actor_user_id: authReq.auth?.sub ?? null,
      entity_id: existing._id.toHexString(),
      payload: { scope: 'tool.deleted' }
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.get('/utils/me', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const db = await getDb();
    const tools = await db
      .collection<ToolDocument>('utils')
      .aggregate<
        ToolDocument & {
          manufacturer?: { _id: ObjectId; nom: string }[];
          image_file?: { _id: ObjectId; url: string }[];
          owner_user?: UserDocument[];
          borrowed_by_user?: UserDocument[];
          localisation_address?: AddressDocument[];
        }
      >([
        { $match: { owner_user_id: new ObjectId(authReq.auth?.sub) } },
        { $sort: { created_at: -1 } },
        {
          $lookup: {
            from: 'manufacturers',
            localField: 'marque',
            foreignField: '_id',
            as: 'manufacturer'
          }
        },
        {
          $lookup: {
            from: 'files',
            localField: 'image_file_id',
            foreignField: '_id',
            as: 'image_file'
          }
        },
        {
          $lookup: {
            from: 'addresses',
            localField: 'localisation_address_id',
            foreignField: '_id',
            as: 'localisation_address'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'owner_user_id',
            foreignField: '_id',
            as: 'owner_user'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'borrowed_by_user_id',
            foreignField: '_id',
            as: 'borrowed_by_user'
          }
        }
      ])
      .toArray();

    res.json(
      tools.map((tool) => ({
        id: tool._id.toHexString(),
        nom: tool.nom,
        categorie: tool.categorie,
        description: tool.description ?? null,
        localisation_address_id: tool.localisation_address_id?.toHexString?.() ?? null,
        localisation_address: tool.localisation_address?.[0]
          ? {
              id: tool.localisation_address[0]._id.toHexString(),
              user_id: tool.localisation_address[0].user_id.toHexString(),
              label: tool.localisation_address[0].label,
              rue: tool.localisation_address[0].rue,
              ville: tool.localisation_address[0].ville,
              code_postal: tool.localisation_address[0].code_postal
            }
          : null,
        marque_id: tool.marque?.toHexString?.() ?? null,
        marque: tool.manufacturer?.[0]?.nom ?? null,
        image_file_id: tool.image_file_id?.toHexString?.() ?? null,
        image_url: tool.image_file?.[0]?.url ?? null,
        owner_user_id: tool.owner_user_id?.toHexString?.() ?? null,
        owner_user: tool.owner_user?.[0]
          ? {
              id: tool.owner_user[0]._id.toHexString(),
              first_name: tool.owner_user[0].first_name,
              last_name: tool.owner_user[0].last_name,
              email: tool.owner_user[0].email
            }
          : null,
        borrowed_by_user_id: tool.borrowed_by_user_id?.toHexString?.() ?? null,
        borrowed_by_user: tool.borrowed_by_user?.[0]
          ? {
              id: tool.borrowed_by_user[0]._id.toHexString(),
              first_name: tool.borrowed_by_user[0].first_name,
              last_name: tool.borrowed_by_user[0].last_name,
              email: tool.borrowed_by_user[0].email
            }
          : null,
        etat: tool.etat,
        disponible: tool.disponible,
        created_at: tool.created_at,
        updated_at: tool.updated_at
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.put('/utils/:id', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const toolId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { nom, categorie, description, localisation_address_id, borrowed_by_user_id, etat, disponible } = req.body as {
    nom?: string;
    categorie?: string;
    description?: string;
    localisation_address_id?: string;
    borrowed_by_user_id?: string | null;
    etat?: 'neuf' | 'bon' | 'use';
    disponible?: boolean;
  };

  if (!ObjectId.isValid(toolId)) {
    res.status(400).json({ message: 'ID outil invalide' });
    return;
  }

  if (categorie && !isToolCategory(categorie)) {
    res.status(400).json({ message: `Categorie invalide. Categories autorisees: ${TOOL_CATEGORIES.join(', ')}` });
    return;
  }

  if (borrowed_by_user_id && !ObjectId.isValid(borrowed_by_user_id)) {
    res.status(400).json({ message: 'borrowed_by_user_id invalide' });
    return;
  }
  if (localisation_address_id && !ObjectId.isValid(localisation_address_id)) {
    res.status(400).json({ message: 'localisation_address_id invalide' });
    return;
  }

  const validEtats = ['neuf', 'bon', 'use'];
  if (etat && !validEtats.includes(etat)) {
    res.status(400).json({ message: 'Etat invalide (neuf, bon, use)' });
    return;
  }

  try {
    const db = await getDb();
    const existing = await db.collection<ToolDocument>('utils').findOne({ _id: new ObjectId(toolId) });

    if (!existing) {
      res.status(404).json({ message: 'Outil introuvable' });
      return;
    }

    const isOwner = existing.owner_user_id.toHexString() === authReq.auth?.sub;
    const isAdmin = authReq.auth?.role === 'admin';
    if (!isOwner && !isAdmin) {
      res.status(403).json({ message: 'Acces refuse: seul le proprietaire peut modifier cet outil' });
      return;
    }

    const updateDoc: Partial<ToolDocument> & { updated_at: Date } = { updated_at: new Date() };
    const unsetDoc: Record<string, ''> = {};

    if (nom !== undefined) {
      updateDoc.nom = nom.trim() || existing.nom;
    }
    if (categorie !== undefined && isToolCategory(categorie)) {
      updateDoc.categorie = categorie;
    }
    if (description !== undefined) {
      const nextDescription = description.trim();
      if (nextDescription) updateDoc.description = nextDescription;
      else unsetDoc.description = '';
    }
    if (localisation_address_id !== undefined) {
      const address = await db.collection<AddressDocument>('addresses').findOne({ _id: new ObjectId(localisation_address_id) });
      if (!address) {
        res.status(400).json({ message: 'L\'adresse de localisation referencee n\'existe pas' });
        return;
      }
      updateDoc.localisation_address_id = address._id;
    }
    if (etat !== undefined) {
      updateDoc.etat = etat;
    }

    let borrowedByUserId: ObjectId | undefined;
    if (borrowed_by_user_id !== undefined && borrowed_by_user_id !== null && borrowed_by_user_id !== '') {
      borrowedByUserId = new ObjectId(borrowed_by_user_id);
      const borrowedUser = await db.collection<UserDocument>('users').findOne({ _id: borrowedByUserId });
      if (!borrowedUser) {
        res.status(400).json({ message: 'L\'emprunteur reference n\'existe pas' });
        return;
      }
      updateDoc.borrowed_by_user_id = borrowedByUserId;
      updateDoc.disponible = false;
    } else if (borrowed_by_user_id === null || borrowed_by_user_id === '') {
      unsetDoc.borrowed_by_user_id = '';
      updateDoc.disponible = disponible ?? true;
    } else if (disponible !== undefined) {
      updateDoc.disponible = disponible;
    }

    const updateOperation: { $set: Partial<ToolDocument> & { updated_at: Date }; $unset?: Record<string, ''> } = {
      $set: updateDoc
    };
    if (Object.keys(unsetDoc).length > 0) {
      updateOperation.$unset = unsetDoc;
    }

    const result = await db
      .collection<ToolDocument>('utils')
      .findOneAndUpdate({ _id: existing._id }, updateOperation, { returnDocument: 'after' });

    if (!result) {
      res.status(404).json({ message: 'Outil introuvable' });
      return;
    }

    emitAppEvent({
      type: 'tool.updated',
      actor_user_id: authReq.auth?.sub ?? null,
      entity_id: result._id.toHexString(),
      payload: { scope: 'tool.update' }
    });

    res.json({
      id: result._id.toHexString(),
      nom: result.nom,
      categorie: result.categorie,
      description: result.description ?? null,
      localisation_address_id: result.localisation_address_id?.toHexString?.() ?? null,
      borrowed_by_user_id: result.borrowed_by_user_id?.toHexString?.() ?? null,
      etat: result.etat,
      disponible: result.disponible,
      updated_at: result.updated_at
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.put('/utils/:id/image', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const toolId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { file_id } = req.body as { file_id?: string };

  if (!ObjectId.isValid(toolId)) {
    res.status(400).json({ message: 'ID outil invalide' });
    return;
  }

  if (!file_id || !ObjectId.isValid(file_id)) {
    res.status(400).json({ message: 'file_id invalide' });
    return;
  }

  try {
    const db = await getDb();
    const existing = await db.collection<ToolDocument>('utils').findOne({ _id: new ObjectId(toolId) });
    if (!existing) {
      res.status(404).json({ message: 'Outil introuvable' });
      return;
    }

    const isOwner = existing.owner_user_id.toHexString() === authReq.auth?.sub;
    const isAdmin = authReq.auth?.role === 'admin';
    if (!isOwner && !isAdmin) {
      res.status(403).json({ message: 'Acces refuse: seul le proprietaire peut modifier la photo' });
      return;
    }

    const fileObjectId = new ObjectId(file_id);
    const file = await db.collection('files').findOne({ _id: fileObjectId });

    if (!file) {
      res.status(404).json({ message: 'Fichier introuvable' });
      return;
    }

    const result = await db.collection('utils').findOneAndUpdate(
      { _id: existing._id },
      {
        $set: {
          image_file_id: fileObjectId,
          updated_at: new Date(),
          updated_by: new ObjectId(authReq.auth?.sub)
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      res.status(404).json({ message: 'Outil introuvable' });
      return;
    }

    emitAppEvent({
      type: 'tool.updated',
      actor_user_id: authReq.auth?.sub ?? null,
      entity_id: result._id.toHexString(),
      payload: { scope: 'tool.image' }
    });

    res.json({
      message: 'Image outil mise a jour',
      tool_id: result._id.toHexString(),
      image_file_id: file_id,
      image_url: file.url
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.get('/utils/manufacturers', async (_req, res) => {
  try {
    const db = await getDb();
    const manufacturers = await db.collection<ManufacturerDocument>('manufacturers').find().sort({ nom: 1 }).toArray();

    res.json(
      manufacturers.map((item) => ({
        id: item._id.toHexString(),
        nom: item.nom,
        pays: item.pays ?? null,
        site_web: item.site_web ?? null,
        icon: item.icon ?? null,
        created_at: item.created_at,
        updated_at: item.updated_at
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.post('/utils/manufacturers', requireAdmin, async (req, res) => {
  const { nom, pays, site_web, icon } = req.body as {
    nom?: string;
    pays?: string;
    site_web?: string;
    icon?: string;
  };

  if (!nom?.trim()) {
    res.status(400).json({ message: 'Le champ nom est requis' });
    return;
  }

  try {
    const db = await getDb();
    const now = new Date();
    const doc = {
      nom: nom.trim(),
      pays: pays?.trim() || null,
      site_web: site_web?.trim() || null,
      icon: icon?.trim() || null,
      created_at: now,
      updated_at: now
    };

    const result = await db.collection('manufacturers').insertOne(doc);
    res.status(201).json({ id: result.insertedId.toHexString(), ...doc });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.put('/utils/manufacturers/:id', requireAdmin, async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { nom, pays, site_web, icon } = req.body as {
    nom?: string;
    pays?: string;
    site_web?: string;
    icon?: string;
  };

  if (!ObjectId.isValid(id)) {
    res.status(400).json({ message: 'ID invalide' });
    return;
  }

  if (!nom?.trim()) {
    res.status(400).json({ message: 'Le champ nom est requis' });
    return;
  }

  try {
    const db = await getDb();
    const update = {
      nom: nom.trim(),
      pays: pays?.trim() || null,
      site_web: site_web?.trim() || null,
      icon: icon?.trim() || null,
      updated_at: new Date()
    };

    const result = await db
      .collection('manufacturers')
      .findOneAndUpdate({ _id: new ObjectId(id) }, { $set: update }, { returnDocument: 'after' });

    if (!result) {
      res.status(404).json({ message: 'Manufacturer introuvable' });
      return;
    }

    res.json({
      id: result._id.toHexString(),
      nom: result.nom,
      pays: result.pays ?? null,
      site_web: result.site_web ?? null,
      icon: result.icon ?? null,
      created_at: result.created_at,
      updated_at: result.updated_at
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.delete('/utils/manufacturers/:id', requireAdmin, async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!ObjectId.isValid(id)) {
    res.status(400).json({ message: 'ID invalide' });
    return;
  }

  try {
    const db = await getDb();
    const result = await db.collection('manufacturers').deleteOne({ _id: new ObjectId(id) });

    if (!result.deletedCount) {
      res.status(404).json({ message: 'Manufacturer introuvable' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

export default router;
